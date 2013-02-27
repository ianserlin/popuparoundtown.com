Meteor.startup(function () {
  Venues._ensureIndex({location: "2d"});
});

Meteor.methods({
  getOwnerEmail: function(id){
    return Meteor.users.findOne({_id: id});
  }
});

Meteor.publish('nearbyVenues', function(coordinates){
  if(_.isUndefined(coordinates)){
    return Venues.find({});
  }else{
    return Venues.find({location: { $near: coordinates, $maxDistance: 0.1}})
  }
});

Meteor.publish('myVenues', function(){
  return Venues.find({ owner: this.userId });
});

Venues.allow({
  insert: function (userId, doc) {
    // the user must be logged in, and the document must be owned by the user
    return (userId && doc.owner === userId);
  },
  update: function (userId, docs, fields, modifier) {
    // can only change your own documents
    return _.all(docs, function(doc) {
      return doc.owner === userId;
    });
  },
  remove: function (userId, docs) {
    return true;
    // can only remove your own documents
    return _.all(docs, function(doc) {
      return doc.owner === userId;
    });
  },
  fetch: ['owner']
});

Venues.deny({
  update: function (userId, docs, fields, modifier) {
    // can't change owners
    return _.contains(fields, 'owner');
  },
  remove: function (userId, docs) {
    // can't remove locked documents
    return _.any(docs, function (doc) {
      return doc.locked;
    });
  },
  fetch: ['locked'] // no need to fetch 'owner'
});

Meteor.users.deny({
  update: function() { return true; }
  , remove: function(){ return true; }
});