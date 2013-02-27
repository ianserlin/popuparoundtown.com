(function(){

  // COLLECTIONS

  // UTILS
  var Geocoder
    , Map
    , AddressAutocompleter
    , InfoWindow
    , Markers
    , NearbyVenuesSubscription;

	// SUBSCRIPTIONS
	Meteor.subscribe('myVenues');
  // NearbyVenuesSubscription = Meteor.subscribe('nearbyVenues');

	// TEMPLATES
	Template.venues.venues = function(){
		return Venues.find({});
	};

  Template.myVenues.venues = function(){
    return Venues.find({owner: Meteor.userId()});
  }

  Template.myVenues.events({
    'click .addVenue': function(){
      // init new venue form
      AddressAutocompleter = new google.maps.places.Autocomplete($('#inputAddress')[0], {
        types: ['geocode']
      });
      AddressAutocompleter.addListener('place_changed', function(){
        var place = AddressAutocompleter.getPlace();
        $('#newVenueForm [name="latitude"]').val(place.geometry.location.lat());
        $('#newVenueForm [name="longitude"]').val(place.geometry.location.lng());
      });
      AddressAutocompleter.bindTo('bounds', Map);
    }
    , 'click .editVenue': function(e){
      $('#editVenueModal').remove();
      var venue = Venues.findOne({_id: $(e.currentTarget).data('venue')});
      $('#editVenueContainer').html(Template.editVenue({venue: venue}));
      $('#editVenueModal').modal('show');
      AddressAutocompleter = new google.maps.places.Autocomplete($('#editInputAddress')[0], {
        types: ['geocode']
      });
      AddressAutocompleter.addListener('place_changed', function(){
        var place = AddressAutocompleter.getPlace();
        $('#editVenueForm [name="latitude"]').val(place.geometry.location.lat());
        $('#editVenueForm [name="longitude"]').val(place.geometry.location.lng());
      });
      AddressAutocompleter.bindTo('bounds', Map);
    }
  });

	Template.newVenue.userId = function(){
		return Meteor.userId() || '';
	};

	Template.newVenue.events({
		'submit': function(e){
			var venue = _.reduce($(e.currentTarget).serializeArray(), function(result, object){
				result[object.name] = object.value;
				return result;
			}, {});
      if(_.isUndefined(venue.name) || _.isUndefined(venue.address)){
        return false;
      }
      venue.location = [ Number(venue.longitude), Number(venue.latitude) ];
      delete venue.latitude;
      delete venue.longitude;
			Venues.insert(venue, function(err, doc){
        if(!_.isUndefined(doc)){
          $('#newVenueModal').modal('hide');
        }
      });
			return false;
		}
    , 'keydown form': function(e){
      if(e.which == 13 && e.srcElement.nodeName != 'TEXTAREA'){
        e.preventDefault();
      }
    }
	});

  Template.nav.venueCount = function(){
    return Venues.find().count();
  };

  Template.nav.events({
    'submit #zipcodeSearch': function(e){
      Geocoder.geocode({
        address: $('#zipcodeSearchInput').val()
      }, function(results, status){
        if(results && results.length > 0){
          Map.setCenter(results[0].geometry.location);
          var coordinates = [ results[0].geometry.location.lng(), results[0].geometry.location.lat() ];
          if(NearbyVenuesSubscription){ NearbyVenuesSubscription.stop(); }
          Meteor.subscribe('nearbyVenues', [ results[0].geometry.location.lng(), results[0].geometry.location.lat() ]);
        }
      });
      return false;
    }
  });

  Template.map.rendered = function(){
    initMap();
  };

  Template.venues.rendered = function(){
    // init datatable
    $('#venueTable').footable();
  };

	// USER
	Accounts.ui.config({
	  passwordSignupFields: 'EMAIL_ONLY'
	});

	// STARTUP
	Meteor.startup(function(){
    // wire contact display
    $('body').on('click', 'a.contact', function(e){
      var link = $(e.currentTarget);
      // var venue = Venues.findOne({_id: link.data('venue')});
      Meteor.call('getOwnerEmail', link.data('owner'), function(err, owner){
        if(owner && owner.emails && owner.emails.length > 0){
          link.replaceWith('<span>' + owner.emails[0].address + '</span>');
        }
      });
    });

    // TODO Get these in Template.editVenue.events
    $('body').on('submit', '#editVenueForm', function(e){
      var venue = _.reduce($(e.currentTarget).serializeArray(), function(result, object){
        result[object.name] = object.value;
        return result;
      }, {});
      if(_.isUndefined(venue.name) || _.isUndefined(venue.address)){
        return false;
      }
      var _id = venue._id;
      delete venue._id;
      venue.location = [ Number(venue.longitude), Number(venue.latitude) ];
      delete venue.latitude;
      delete venue.longitude;
      Venues.update(_id, { $set: venue }, function(err){
        if(_.isUndefined(err)){
          $('#editVenueModal').modal('hide');
        }
      });
      return false;
    });
    $('body').on('keydown', '#editVenueForm', function(e){
      if(e.which == 13 && e.srcElement.nodeName != 'TEXTAREA'){
        e.preventDefault();
      }
    });
    $('body').on('click', '#editVenueForm .btn-danger', function(e){
      Venues.remove($(e.currentTarget).data('venue'));
    });
	});

  function initMap(){
    Geocoder = new google.maps.Geocoder;
    InfoWindow = new google.maps.InfoWindow({});

    Venues.find({}).observe({
      added: function(){
        addMarkersToMap();
      }
      , changed: function(){
        addMarkersToMap(); 
      }
      , removed: function(){
        addMarkersToMap();
      }
    });

    var initialLocation;
    var newyork = new google.maps.LatLng(40.69847032728747, -73.9514422416687);
    var browserSupportFlag =  new Boolean();

    Map = new google.maps.Map(document.getElementById("map"), {
      zoom: 12,
      mapTypeId: google.maps.MapTypeId.ROADMAP
    });

    Map.addListener('tilesloaded', addMarkersToMap);

    // Try W3C Geolocation (Preferred)
    if(navigator.geolocation) {
      browserSupportFlag = true;
      navigator.geolocation.getCurrentPosition(function(position) {
        if(NearbyVenuesSubscription){ NearbyVenuesSubscription.stop(); }
        Meteor.subscribe('nearbyVenues', [position.coords.longitude, position.coords.latitude]);
        initialLocation = new google.maps.LatLng(position.coords.latitude,position.coords.longitude);
        Map.setCenter(initialLocation);
      }, function() {
        handleNoGeolocation(browserSupportFlag);
      });
    }
    // Browser doesn't support Geolocation
    else {
      browserSupportFlag = false;
      handleNoGeolocation(browserSupportFlag);
    }
    
    function handleNoGeolocation(errorFlag) {
      if (errorFlag == true) {
        alert("Geolocation service failed.");
        initialLocation = newyork;
      } else {
        alert("Your browser doesn't support geolocation. We've placed you in Siberia.");
        initialLocation = newyork;
      }
      if(NearbyVenuesSubscription){ NearbyVenuesSubscription.stop(); }
      Meteor.subscribe('nearbyVenues', [newyork.lng(), newyork.lat()]);
      Map.setCenter(initialLocation);
    }

  }

  function addMarkersToMap(){
    // add markers
    var venues = Venues.find({});
    _.each(Markers, function(marker){
      if(marker){
        marker.setMap(null);
      }
    });

    Markers = [];
    venues.forEach(function(venue){
      var marker = new google.maps.Marker({
        position: new google.maps.LatLng(venue.location[1], venue.location[0]),
        map: Map,
        title: venue.name
      });
      Markers.push(marker);
      google.maps.event.addListener(marker, 'click', function() {
        var content = Template.infoWindow(venue);
        InfoWindow.setContent(content);
        InfoWindow.open(Map, marker);
      });
    });
  }

})();