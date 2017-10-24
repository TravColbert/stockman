const fs = require('fs');
const bcrypt = require('bcryptjs');
let app = {};
app.locals = JSON.parse(fs.readFileSync('config.json'));

var users = {
  myName:"userdb",
  findByUsername:function(username,cb) {
    let methodName = "findByUsername";
    console.log(this.myName + ": " + methodName + ": Checking for name:" + username);
    let user = this.find("username",username)[0];
    if(user) {
      console.log(this.myName + ": " + methodName + ": Found a username that matches",username);
      cb(null,user);
      return;
    }
    console.log(this.myName + ": " + methodName + ": No account found");
    cb(null,false);
    return;
  },
  findById:function(id,cb) {
    let methodName = "findById";
    console.log(this.myName + ": " + methodName + ": Checking for ID:" + id);
    let user = this.find("id",id)[0];
    if(user) {
      console.log(this.myName + ": " + methodName + ": Found user record that matches ID",id);
      cb(null,user);
      return;
    }
    console.log(this.myName + ": " + methodName + ": No account found");
    cb(null,false);
    return;
  },
  find:function(field,val) {
    let methodName = "find";
    console.log(this.myName + ": " + methodName + ": Searching: ",field," for: ",val);
    let user = this.db.filter(function(userRecord) {
      return userRecord[field]==val;
    },this);
    return user;
  },
  nextIndex:function() {
    console.log("Selecting next index");
    let x=this.db.length;
    console.log("Current index: " + x);
    while(this.find("id",x).length>0) {
      console.log("Searching index: " + x++);
    }
    return x;
  },
  add:function(userObj) {
    let checkPw = function(user) {
      if(user.password!=user.passwordv) {
        req.session.messages.push(makeMessage({type:"warn",text:"Passwords do not match"}));
        return false;
      }
      return true;
    }
    if(!checkPw(userObj)) return false;
    this.hashPw({
      id:this.nextIndex(),
      username:userObj.username,
      password:userObj.password
    });
    return true;
  },
  hashPw:function(user) {
    if(!user.hasOwnProperty('password')) return false;
    bcrypt.genSalt(10,function(err,salt) {
      bcrypt.hash(user.password,salt,function(err,hash) {
        user.password = hash;
        console.log("user: add: hashPw: User to save: " + JSON.stringify(user));
        this.db.push(user);
        this.writeDb();
      }.bind(this));
    }.bind(this));
  },
  readDb:function(cb) {
    let methodName = "readDb";
    console.log(this.myName + ": " + methodName + ": Attempting read of stored users data from: " + app.locals.usersDbFile);
    fs.readFile(app.locals.usersDbFile,'utf8',function(err,data) {
      console.log(data);
      // if(err) throw err;
      console.log("DATA: " + JSON.stringify(data));
      this.db = JSON.parse(data);
      console.log(JSON.stringify(this.db));
      cb();
    }.bind(this));
    return;
  },
  writeDb:function() {
    let methodName = "writeDb";
    console.log(this.myName + ": " + methodName + ": Attempting write of in-memory user data...");
    fs.writeFile(app.locals.usersDbFile,JSON.stringify(this.db),function(err) {
      if(err) {
        console.log(this.myName + ": " + methodName + ": Seems there was an error!");
        throw err;
      }
      console.log(this.myName + ": " + methodName + ": Write success!");
    }.bind(this));
    return;
  },
  db:[]
};

users.readDb(function(){
  var us, pw;
  if(process.argv[2]!==null && process.argv[2]!==undefined) {
    us = process.argv[2];
    if(process.argv[3]!==null && process.argv[3]!==undefined) {
      pw = process.argv[3];
      console.log(users.db);
      users.add({
        username:us,
        password:pw,
        passwordv:pw
      });
    }
  }
});

/**
 * Middleware
 */
var logThis = function(string) {
  console.log(" => " + string);
  return true;
};
