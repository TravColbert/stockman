#!/usr/bin/node
const fs = require('fs');
const https = require('https');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
// const querystring = require('querystring');
const app = express();
const nodemailer = require('nodemailer');

app.locals = JSON.parse(fs.readFileSync('config.json'));
app.locals.url = "https://" + app.locals.addr;
if(app.locals.port!="443") app.locals.url += ":" + app.locals.port;
const options = {
  key: fs.readFileSync(app.locals.keyFile),
  cert: fs.readFileSync(app.locals.certFile)
}
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
let sessionConfig = {
  secret:app.locals.sessionSecret,
  resave:false,
  saveUninitialized:false
};

let transporter = nodemailer.createTransport({
  host: app.locals.smtpServer,
  port: app.locals.smtpPort,
  secure: app.locals.smtpSecurity,
  ignoreTLS: true
});

/**
 * Configuration
 */
// Template Engine setup:
app.set('views',app.locals.viewsDir);
app.set('view engine','pug');
app.set('query parser',true);
app.use(express.static(app.locals.staticDir));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:true}));
app.use(session(sessionConfig));
app.use(passport.initialize());
app.use(passport.session());

/**
 * The app's menu
 *
 * {link,text[,secured]}
 *
 * link:    the path part of the URL. The href
 * text:    what appears on the menu
 * secured: if absent - show the menu item all the time
 *          if true - show the menu item only when logged-in
 *          if false - show the menu item only when logged-out
 */
let menu = [
  {link:"/parts",text:"Parts",icon:"devices"},
  {link:"/cases",text:"Cases",icon:"content_paste"},
  /*{link:"/update",text:"Update Database",icon:"update",secured:true},*/
  {link:"/users",text:"Users",icon:"people_outline",secured:true},
  /*{link:"/about",text:"About",icon:"info_outline"},*/
  {link:"/login",text:"Log In",icon:"verified_user",secured:false},
  {link:"/logout",text:"Log Out",icon:"highlight_off",secured:true},
];

let cases = {
  myName:"casedb",
  add:function(caseRecord) {
    let methodName = 'add';
    if(this.find("id",caseRecord.id).length>0) return false;
    console.log(methodName + ": Pushing record: " + caseRecord.id + " " + JSON.stringify(caseRecord));
    this.db.push({
      id:caseRecord.id,
      time:caseRecord.time,
      owner:caseRecord.owner
    });
    return caseRecord.id;
  },
  search:function(searchString,field) {
    field = field || null;
    let results = this.db.filter(function(itemRecord) {
      let targetString = itemRecord.id.toLowerCase() + " " + itemRecord.owner.toLowerCase();
      return targetString.includes(searchString);
    });
    return results;
  },
  write:function(caseRecord) {
    let methodName = 'write';
    logThis(methodName + ": " + JSON.stringify(caseRecord));
    let index = this.findIndex(caseRecord.id);
    console.log("Cases DB: found existing index " + index);
    if(index==-1) {
      this.add(caseRecord);
    } else {
      this.db[index].time=caseRecord.time;
      this.db[index].owner=caseRecord.owner;
    }
    return true;
  },
  findIndex:function(caseId) {
    let methodName = 'findIndex';
    let index = this.db.findIndex(function(record) {
      return record.id==caseId;
    });
    return index;
  },
  find:function(field,val) {
    let methodName = "find";
    console.log(this.myName + ": " + methodName + ": Searching: " + field + " for: " + val);
    let part = this.db.filter(function(record) {
      return record[field]==val;
    },this);
    return part;
  },
  sort:function(compare) {
    let methodName = "sort";
    console.log(this.myName + ": " + methodName + ": Sorting db");
    compare = compare || null;
    let caseList = this.db;
    return caseList.sort(compare);
  },
  readDb:function() {
    let methodName = "readDb";
    console.log(this.myName + ": " + methodName + ": Attempting read of stored data...");
    fs.readFile(app.locals.casesDbFile,'utf8',function(err,data) {
      if(err) throw err;
      this.db = JSON.parse(data);
      console.log(JSON.stringify(this.db));
      return true;
    }.bind(this));
    return;
  },
  writeDb:function() {
    let methodName = "writeDb";
    console.log(this.myName + ": " + methodName + ": Attempting write of in-memory data...");
    fs.writeFile(app.locals.casesDbFile,JSON.stringify(this.db),function(err) {
      if(err) {
        console.log(this.myName + ": " + methodName + ": Seems there was an error!");
        throw err;
      }
      console.log(this.myName + ": " + methodName + ": Write success!");
    }.bind(this));
    return;
  }
}

cases.readDb();

let parts = {
  myName:"partdb",
  add:function(part) {
    let methodName = 'add';
    let x=this.db.length;
    while(this.find("id",x).length>0) {
      console.log(methodName + ": Checking ID: " + x);
      x++;
    }
    console.log(methodName + ": Pushing record: " + x + " " + JSON.stringify(part));
    this.db.push({
      id:x,
      partnum:part.partnum,
      description:part.description,
      make:part.make,
      inwarranty:part.inwarranty,
      count:part.count,
      mincount:part.mincount,
      cases:[]
    });
    return x;
  },
  search:function(searchString,field) {
    let methodName = "partsearch";
    console.log(methodName + ": Searching for: " + searchString);
    field = field || null;
    let targetString;
    let results = this.db.filter(function(itemRecord) {
      targetString = '';
      if(itemRecord.partnum)
        targetString += itemRecord.partnum.toLowerCase() + " ";
      if(itemRecord.partaltnum)
        targetString += itemRecord.partaltnum.toLowerCase() + " ";
      if(itemRecord.description)
        targetString += itemRecord.description.toLowerCase() + " ";
      if(itemRecord.make)
        targetString += itemRecord.make.toLowerCase();
      // console.log(targetString);
      // console.log(targetString.indexOf(searchString));
      return targetString.includes(searchString);
    });
    console.log(methodName + ": Found " + results.length + " records");
    return results;
  },
  find:function(field,val) {
    let methodName = "find";
    console.log(this.myName + ": " + methodName + ": Searching: " + field + " for: " + val);
    let part = this.db.filter(function(partRecord) {
      return partRecord[field]==val;
    },this);
    return part;
  },
  findByCase:function(caseNum) {
    let methodName = 'findByCase';
    console.log(this.myName + ": " + methodName + ": Searching for parts by case #: " + caseNum);
    let parts = this.db.filter(function(partRecord) {
      return (partRecord.cases.indexOf(caseNum)>-1);
    },this);
    return parts;
  },
  countFree:function(id) {
    let methodName = 'countFree';
    let record = this.find('id',id);
    console.log(this.myName + ": " + methodName + ": Found: " + record.length + " records");
    if(record.length<1) return false;
    console.log(this.myName + ": " + methodName + ": Number of CHECKED-OUT units: " + record[0].cases.length);
    return (record[0].count - record[0].cases.length);
  },
  countUsed:function(id) {
    let methodName = 'countUsed';
    let record = this.find('id',id);
    console.log(this.myName + ": " + methodName + ": Found: " + record.length + " records");
    if(record.length<1) return false;
    console.log(this.myName + ": " + methodName + ": Number of CHECKED-OUT units: " + record[0].cases.length);
    return record[0].cases.length;
  },
  getCases:function() {
    let methodName = 'getCases';
    let caseList = [];
    this.db.forEach(function(v,i,a) {
      console.log(parts.myName + ": " + methodName + ": Getting caselist for part: " + v.id + " (" + JSON.stringify(v.cases) + ")");
      let partCases = v.cases.filter(function(c) {
        return caseList.indexOf(c)==-1;
      })
      console.log(parts.myName + ": " + methodName + ": Got this: " + v.id + " (" + JSON.stringify(partCases) + ")");
      caseList = caseList.concat(partCases);
    });
    caseList.sort();
    console.log(this.myName + ": " + methodName + ": Case list:" + JSON.stringify(caseList));
    return caseList;
  },
  /**
   * Checking in and out parts is a matter of adding and removing case numbers from an
   * array in the part record.
   * To check-in  : add a case number to the array
   * To check-out : remove a case number from the array
   *
   * The 'count' property now indicates the total desired parts in the stock
   */

  /**
   * Checking-in will involve submitting am ID indicating the part and a case (or cases)
   * That list of cases will be removed from the 'cases' property.
   */
  checkin:function(id,cases) {
    let delCase = function(index,caseNum) {
      console.log("delCase: Deleting case#: " + caseNum + " from part at index: " + index);
      let idx = parts.db[index].cases.indexOf(cases);  // Find the position of the case
      if(idx<0) {
        console.log("delCase: Couldn't find that case # (" + caseNum + ") in the case list (" + JSON.stringify(parts.db[index].cases) + ")");
        return false;
      }
      console.log("delCase: Found case#: " + caseNum + " at index : " + idx + " in case list");
      // What if multiple parts were checked-out for one case?
      if(parts.db[index].cases.splice(idx,1).length==0) return false;
      return true;
    };
    let partIndex = this.db.findIndex(function(v) {
      return v.id==id;
    });
    if(partIndex<0) return false;     // No parts found

    if(!Array.isArray(cases)) {
      // Assigning one part into a case...
      console.log("Free + 1: " + (this.countFree(id)+1) + " Count: " + this.db[partIndex].count);
      if((this.countFree(id)+1)>this.db[partIndex].count) return false;  // Can't assign any more parts to cases (more than the stock number)
      return delCase(partIndex,cases);
    }
    if((this.countFree(id)-cases.length)<0) return false;  // Can't assign any more parts to cases (none left)
    let success = true;
    cases.forEach(function(v,i,a) {
      if(!delCase(partIndex,v)) success=false;
    });
    return success;
    // this.db[partIndex].count += num;
    // return true;
  },
  /**
   * Checking-out will involve submitting am ID indicating the part and a case (or cases)
   * That list of cases will be added to the 'cases' property.
   */
  checkout:function(id,cases) {
    let methodName = 'checkout';
    console.log(this.myName + ": " + methodName + ": Searching: " + id + " for: " + JSON.stringify(cases));
    let partIndex = this.db.findIndex(function(v) {
      return v.id==id;
    });
    if(partIndex<0) return false;     // No parts found
    if(!Array.isArray(cases)) {
      // Assigning one part into a case...
      if((this.countFree(id)-1)<0) return false;  // Can't assign any more parts to cases (none left)
      this.db[partIndex].cases.push(cases);
    } else {
      if((this.countFree(id)-cases.length)<0) return false;  // Can't assign any more parts to cases (none left)
      this.db[partIndex].cases.concat(cases);
    }
    return true;
  },
  readDb:function() {
    let methodName = "readDb";
    console.log(this.myName + ": " + methodName + ": Attempting read of stored parts data...");
    fs.readFile(app.locals.partsDbFile,'utf8',function(err,data) {
      if(err) throw err;
      this.db = JSON.parse(data);
      console.log(JSON.stringify(this.db));
      return true;
    }.bind(this));
    return;
  },
  writeDb:function() {
    let methodName = "writeDb";
    console.log(this.myName + ": " + methodName + ": Attempting write of in-memory data...");
    fs.writeFile(app.locals.partsDbFile,JSON.stringify(this.db),function(err) {
      if(err) {
        console.log(this.myName + ": " + methodName + ": Seems there was an error!");
        throw err;
      }
      console.log(this.myName + ": " + methodName + ": Write success!");
    }.bind(this));
    return;
  }
};

parts.readDb();

/**
 * The Users DB with functions that hook into Passport
 */
let users = {
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
  add:function(userObj) {
    let checkPw = function(user) {
      if(user.password!=user.passwordv) {
        req.session.messages.push(makeMessage({type:"warn",text:"Passwords do not match"}));
        return false;
      }
      return true;
    }
    let getNextIndex = function(userDb) {
      let x=userDb.db.length;
      while(userDb.find("id",x).length>0) {
        x++;
      }
      return x;
    }
    let hashPw = function(user,db) {
      if(!user.hasOwnProperty('password')) return false;
      bcrypt.genSalt(10,function(err,salt) {
        bcrypt.hash(user.password,salt,function(err,hash) {
          user.password = hash;
          console.log("user: add: hashPw: User to save: " + JSON.stringify(user));
          db.db.push(user);
          db.writeDb();
        });
      });
    }
    if(!checkPw(userObj)) return false;
    hashPw({
      id:getNextIndex(this),
      username:userObj.username,
      email:userObj.email,
      password:userObj.password
    },this);
    return true;
  },
  search:function(searchString,field) {
    field = field || "username";
    let results = this.db.filter(function(itemRecord) {
      return itemRecord[field].toLowerCase().includes(searchString);
    });
    return results;
  },
  readDb:function() {
    let methodName = "readDb";
    console.log(this.myName + ": " + methodName + ": Attempting read of stored users data...");
    fs.readFile(app.locals.usersDbFile,'utf8',function(err,data) {
      if(err) throw err;
      this.db = JSON.parse(data);
      console.log(JSON.stringify(this.db));
      return true;
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
  }
};

users.readDb();

passport.use(new LocalStrategy(
  function(username,password,done) {    // Passport Local Verification function
    users.findByUsername(username,function(err,user) {
      if(err) {
        console.log("Some kind of error:",err);
        return done(err);
      }
      if(!user) {
        console.log("No user");
        return done(null,false,{message:"Invalid account"});
      }
      if(!bcrypt.compareSync(password,user.password)) {
        console.log("Wrong password");
        return done(null,false,{message:"Invalid password"});
      }
      console.log("Passed!");
      return done(null,user,{message:"Authentication succeeded"});
    });
  }
));

passport.serializeUser(function(user,cb) {
  cb(null,user.id);
});

passport.deserializeUser(function(id,cb) {
  let myName = "passport.deserializeUser";
  users.findById(id,function(err,user) {
    if(err) return cb(err,null);
    logThis(myName + ": SESSION-CHECK: Found user: " + user.username);
    //cb(null,user.username);
    cb(null,user);
  });
});

/**
 * Middleware
 */
var logThis = function(string) {
  console.log(" => " + string);
  return true;
}

var appIgnoreFavicon = function(req,res,next) {
  let myName = "appIgnoreFavicon";
  if(req.url=='/favicon.ico') {
    res.writeHead(200, {'Content-Type': 'image/x-icon'});
    logThis(myName + ": (sent favicon)");
    return res.end();
  }
  return next();
}

var appStats = function(req,res,next) {
  let myName = "appStats";
  logThis(myName + ": vvvvvvvvvv");
  logThis(myName + ": Got a request of type: " + req.protocol + " :" + req.method + " TO: " + req.originalUrl);
  logThis(myName + ": URL: " + req.url);
  if(req.session) {
    logThis(myName + ": Session: " + JSON.stringify(req.session));
    req.session.originalReq = (req.originalUrl!="/login") ? req.originalUrl : req.session.originalReq;
  }
  return next();
}

var appStart = function(req,res,next) {
  let myName = "appStart";
  logThis(myName + ": Original request: " + req.session.originalReq);
  logThis(myName + ": Clearing appData");
  req.appData = {};
  logThis(myName + ": Setting app name");
  req.appData.title = app.locals.appName;
  req.appData.messages = [];
  return next();
}

var appMessages = function(req,res,next) {
  let myName = "appMessages";
  logThis(myName + ": Setting up messages");
  if(req.session.hasOwnProperty("messages")) {
    if(req.session.messages.length>0) {
      logThis(JSON.stringify(req.session.messages));
      req.appData.messages = req.session.messages;
    }
  } else {
    req.session.messages = [];
  }
  return next();
}

var isAuthenticated = function(req) {
  if(!req.session.cookie) return false;
  if(!req.user) return false;
  if(!req.user.username) return false;
  if(users.find("username",req.user.username).length<1) return false;
  return true;
}

var appCheckAuthentication = function(req,res,next) {
  let myName = "appCheckAuthentication";
  logThis(myName + ": Starting authentication check...");
  if(!isAuthenticated(req)) return res.redirect('/login');
  logThis(myName + ": Found session for: " + JSON.stringify(req.user.username));
  logThis(myName + ": session is authenticated");
  return next();
}

var timeStart = function(req,res,next) {
  let myName = "timeStart";
  logThis(myName);
  req.appData.startTime = Date.now();
  return next();
}

var appGetMenu = function(req,res,next) {
  let myName = "appGetMenu";
  logThis(myName + ": Building menu object");
  req.appData.menu = [];
  menu.forEach(function(v,i,a) {
    if(!v.hasOwnProperty("secured")) {
      req.appData.menu.push(v);
    } else {
      if(v.secured && req.user) req.appData.menu.push(v);
      if(!v.secured && !req.user) req.appData.menu.push(v);
    }
  });
  return next();
}

var appHello = function(req,res,next) {
  var myName = "appHello";
  if(req.user) {
    logThis(myName + ": User: " + req.user.username + " id: " + req.user.id);
    req.appData.account = req.user.username;
    req.appData.accountNum = req.user.id;  
  }
  return next();
}

var secureApp = function(req,res,next) {
  var myName = "secureApp";
  logThis(myName);
  responseString += "<br>\n!!! SUPER SECURE DATA !!!";
  return next();
}

var setSessionData = function(req,res,next) {
  let myName = "setSessionData";
  if(!req.appData.views) {
    req.appData.views = 0;
  }
  req.appData.views++;
  return next();
}

var timeEnd = function(req,res,next) {
  let myName = "timeEnd";
  logThis(myName);
  req.appData.stopTime = Date.now();
  return next();
}

var appRender = function(req,res) {
  let myName = "appRender";
  let templateFile = req.appData.mode || "index";
  if(req.session.hasOwnProperty("messages")) {
    if(req.session.messages.length>0) req.appData.messages = req.session.messages;
  }
  logThis(myName + ": Sending off to template: " + templateFile + " (" + req.appData.mode + ")");
  // logThis(myName + ": " + JSON.stringify(req.appData));
  res.render(templateFile,req.appData);
}

var generateString = function(length) {
  let myName = "generateString";
  length = parseInt(length);
  let sauce = '';
  while(sauce.length<length) {
    sauce += (Math.random()+1).toString(36).substring(2);
    logThis(myName + ": More sauce: " + sauce);
  }
  logThis(myName + ": Final sauce (length " + length + "): " + sauce);
  return sauce.substring(null,length);
}

var appLoginPage = function(req,res,next) {
  let myName = "appLoginPage";
  logThis("...(sending login page)...");
  // let salt = bcrypt.genSaltSync(10);
  req.appData.mode = "login";
  let secretSauce = generateString(12);
  logThis(myName + ": Generated secret sauce of: " + secretSauce);
  // req.appData.secretSauce = "blahblahblah";
  req.appData.secretSauce = secretSauce;
  return next();
}

var appLogout = function(req,res,next) {
  let myName = "appLogout";
  logThis(myName);
  req.logout();
  return res.redirect('/');
}

var appRedirectToOriginalReq = function(req,res) {
  let myName = "appRedirectToOriginalReq";
  let redirectTo = req.session.originalReq || '/';
  logThis(myName + ": Redirecting to: " + redirectTo);
  res.redirect(redirectTo);
  return;
}

var appGetUsers = function(req,res,next) {
  let myName = "appGetUsers";
  logThis(myName + ": Getting user list.");
  req.appData.users = [];
  req.appData.mode = "users";
  users.db.forEach(function(user,i,a) {
    logThis(myName + ": " + user.id + " " + user.username);
    req.appData.users.push({
      id:user.id,
      username:user.username,
      email:user.email
    });
  });
  return next();
}

var appGetUser = function(req,res,next) {
  let myName = "appGetUser";
  let userId = req.params.userId;
  req.appData.mode = "user";
  logThis(myName + ": Getting user with ID: " + userId);
  users.findById(userId,function(err,user) {
    if(err) {
      req.session.messages.push(makeMessage({type:"err",text:"Error getting user with ID:" + userId}));
    } else if(!user) {
      req.session.messages.push(makeMessage({type:"warn",text:"No user found with ID:" + userId}));
    } else {
      req.session.messages.push(makeMessage({type:"succ",text:"Found user ID:" + userId + " " + JSON.stringify(user)}));
      req.appData.user = {
        id:user.id,
        username:user.username,
        email:user.email
      };
      req.appData.cases = cases.find("owner",user.username);
    }
  });
  return next();
}

var appAddUser = function(req,res,next) {
  let myName = "appAddUser";
  logThis(myName + ": Request to add new user");
  req.appData.mode = "adduser";
  return next();
}

var appCreateUser = function(req,res,next) {
  let myName = "appCreateUser";
  logThis(myName + ": Request to create user: " + JSON.stringify(req.body));
  users.add(req.body);
  return res.redirect('/users');
}

var appEditUserVerified = function(req,res,next) {
  let myName = "appEditUserVerified";
  logThis(myName + ": Request to edit user #:" + req.params.userId);
  let userId = req.params.userId;
  let userList = users.find("id",userId);
  if(userList.length<1) return next(new Error("Could not find user " + userId));
  req.appData.user = userList[0];
  req.appData.mode = "edituser";
  return next();
}

var appEditUser = function(req,res,next) {
  let myName = "appEditUser";
  logThis(myName + ": Editing user #:" + req.body.userid);
  logThis(JSON.stringify(req.body));
  if(!req.body.hasOwnProperty("userid") || req.body.userid===null || req.body.userid===undefined) {
    logThis(myName + ": No user ID given. Punting!");
    return res.redirect('/users/');
  }
  let userIndex = users.db.findIndex(function(userRecord) {
    return userRecord.id==req.body.userid;
  });
  if(userIndex==-1) return next(new Error("No user with id: " + req.body.userid));
  users.db[userIndex].email = req.body.email;
  users.writeDb();
  return res.redirect('/user/' + req.body.userid);
}

var appGetParts = function(req,res,next) {
  let myName = "appGetParts";
  logThis(myName + ": Request to get ALL PARTS");
  req.appData.parts = parts.db;
  /* Sort tickets by item description */
  req.appData.parts = req.appData.parts.sort(function(a,b){
    if(a.description<b.description) return -1;
    if(b.description<a.description) return 1;
    return 0;
  });
  if(req.query.compact)
    req.appData.mode = "parts_small";
  else
    req.appData.mode = "parts";
  req.appData.parts.forEach(function(part,i,a) {
    logThis(myName + ": Calculating stock levels for part: " + part.id);
    part.free = parts.countFree(part.id);
    part.used = parts.countUsed(part.id);
  });
  return next();
}

var appGetPart = function(req,res,next) {
  let myName = "appGetPart";
  let partId = req.params.partId;
  logThis(myName + ": Getting part with ID: " + partId);
  // responseString += "<ul>";
  // let partList = parts.find("id",partId);
  req.appData.part = parts.find("id",partId)[0];
  req.appData.part.free = parts.countFree(partId);
  req.appData.part.used = parts.countUsed(partId);
  req.appData.appUrl = app.locals.url;
  req.appData.mode = "part";
  return next();
}

var appAddPart = function(req,res,next) {
  let myName = "appAddPart";
  logThis(myName + ": Request to add new part");
  req.appData.mode = "addpart";
  return next();
}

var appAddPartVerified = function(req,res,next) {
  let myName = "appAddPartVerified";
  logThis(myName + ": Attempting to add part " + req.body.partnum);
  // Maybe just check to ensure that the manufacturer's number is not a dupliacate
  // let duplicatePartNumber = parts.db.findIndex(function(partRecord) {
  //   console.log(myName + ": " + partRecord.partnum + " : " + req.body.partnum);
  //   return partRecord.partnum==req.body.partnum;
  // });
  // logThis(myName + ": " + duplicatePartNumber);
  // if(duplicatePartNumber>-1) {
  //   req.session.messages.push(makeMessage({type:"err",text:"Can't add part with duplicate manufacturer's number"}));
  //   // return next(new Error("Attempting to add part with duplicate manufacturer's number"));
  //   return res.redirect('/parts/');
  // }
  let partId = parts.add({
    partnum:req.body.partnum,
    partaltnum:req.body.partaltnum,
    description:req.body.description,
    inwarranty:!!(req.body.inwarranty=="on"),
    make:req.body.make,
    count:req.body.count,
    mincount:(req.body.mincount) || 1
  });
  if(partId===false) {
    req.session.messages.push(makeMessage({type:"warn",text:"Could not create new part"}));
    return res.redirect("/part/");
  }
  parts.writeDb();
  req.session.messages.push(makeMessage({type:"success",text:"New part added"}));
  return res.redirect('/part/' + partId);
}

/**
 * Perform basic checks on part check-in. Then proceed
 *
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
var appCheckinPartVerified = function(req,res,next) {
  let myName = "appCheckinPartVerified";
  let partId = req.params.partId;
  req.appData.caseId = req.params.caseId;
  logThis(myName + ": Request to verify check-in of part: " + partId);
  let part = parts.find("id",partId);
  if(part.length<1) return next(new Error("Could not find part for check-in"));
  // Check if that case is attached to this part
  if(part[0].cases.indexOf(req.appData.caseId)==-1) next(new Error("This part can't be checked-in from this case"));
  req.appData.part = part[0];
  req.appData.mode = "checkin";
  logThis(myName + ": " + JSON.stringify(part));
  let dateNow = Date.now();
  return next();
}

var appCheckinPart = function(req,res,next) {
  let myName = "appCheckinPart";
  logThis(myName + ": Request to check in part: " + req.body.partid + " in case #: " + req.body.casenum);
  if(parts.checkin(req.body.partid,req.body.caseid)) {
    parts.writeDb();
    logThis(myName + ": Redirecting to: /part/" + req.body.partid);
    req.session.messages.push(makeMessage({type:"info",text:"Thanks! Part has been checked in."}));
    return res.redirect('/part/' + req.body.partid);
  }
  return next(new Error('Something went wrong :-('));
}

var appCheckoutPartVerified = function(req,res,next) {
  let myName = "appCheckoutPartVerified";
  let partId = req.params.partId;
  logThis(myName + ": Request to verify check-out of part: " + partId);
  var part = parts.find("id",partId);
  if(part.length<1) return next(new Error("Could not find part for check-out"));
  req.appData.part = part[0];
  req.appData.mode = "checkout";
  logThis(myName + ": " + JSON.stringify(part));
  let dateNow = Date.now();
  return next();
}

var appCheckoutPart = function(req,res,next) {
  let myName = "appCheckoutPart";
  logThis(myName + ": Request to check out part: " + req.body.partid);
  let partCheckoutSuccess = parts.checkout(req.body.partid,req.body.caseid);
  let caseCreationSuccess = cases.write({
    id:req.body.caseid,
    owner:req.user.username,
    time:Date.now()
  });
  if(!partCheckoutSuccess || !caseCreationSuccess) {
    // parts.rollBackRecord(req.body.partid);
    // cases.rollBackRecord(req.body.caseid);
    return next(new Error('Something went wrong :-('));
  }
  cases.writeDb();
  parts.writeDb();
  let part = parts.find(req.body.partid)[0];
  if(appCheckPartLevels(req.body.partid,part.mincount)<0) {
    logThis(myName + ": Part levels are low. I want to send a message");
    // Get who to warn
    let mailTo = 'travis@dataimpressions.com, michael.simpson@dataimpressions, seth@dataimpressions.com';
    let subject = 'Part Supply Is Low for part: ' + part.partnum;
    let body = `
    The supply of part: <strong>${part.partnum} ${part.description} </strong>has run below <span style='color:"#f33"'>${part.mincount}</span>.</br>
    Current available units: <span style='color:"#f33"'>${part.free}</span></br>
    Check the facts in <strong><a href="${app.locals.url}/part/${part.id}">${app.locals.appName}</a></strong>.
    Sincerely,</br>
    stockr`;
    // Launch warnings: e-mail, DOM class markers etc)
    sendEmail(mailTo,subject,body);
  }
  req.session.messages.push(makeMessage({type:"info",text:"Thanks! Part: '" + part.description + "' has been checked out."}));
  return res.redirect('/part/' + req.body.partid);
}

var appCheckPartLevels = function(partId,mincount) {
  let myName = "appCheckPartLevels";
  let partsLeft = parts.countFree(partId);
  logThis(myName + ": We have: " + partsLeft + " parts left.");
  if(partsLeft<mincount) return -1;
  return 0;
};

var appEditPartVerified = function(req,res,next) {
  let myName = "appEditPartVerified";
  logThis(myName + ": Request to edit part #:" + req.params.partId);
  let partId = req.params.partId;
  let partList = parts.find("id",partId);
  if(partList.length<1) return next(new Error("Could not find part " + partId));
  req.appData.part = partList[0];
  req.appData.mode = "editpart";
  return next();
}

var appEditPart = function(req,res,next) {
  let myName = "appEditPart";
  logThis(myName + ": Editing part #:" + req.body.partid);
  logThis(JSON.stringify(req.body));
  if(!req.body.hasOwnProperty("partid") || req.body.partid===null || req.body.partid===undefined) {
    logThis(myName + ": No part ID given. Punting!");
    return res.redirect('/parts/');
  }
  let partIndex = parts.db.findIndex(function(partRecord) {
    return partRecord.id==req.body.partid;
  });
  if(partIndex==-1) return next(new Error("No part with id: " + req.body.partid));
  parts.db[partIndex].partnum = req.body.partnum;
  parts.db[partIndex].partaltnum = req.body.partaltnum;
  parts.db[partIndex].description = req.body.description;
  console.log(" * * * IN-WARRANTY: " + !!(req.body.inwarranty=="on") + " * * *");
  parts.db[partIndex].inwarranty = !!(req.body.inwarranty=="on");
  parts.db[partIndex].make = req.body.make;
  parts.db[partIndex].count = req.body.count;
  parts.db[partIndex].mincount = (req.body.mincount) || 1;
  parts.writeDb();
  return res.redirect('/part/' + req.body.partid);
}

var appPrintPart = function(req,res,next) {
  let myName = "appPrintPart";
  let partId = req.params.partId;
  logThis(myName + ": Printing part #:" + partId);
  req.appData.part = parts.find("id",partId)[0];
  req.appData.part.free = parts.countFree(partId);
  req.appData.part.used = parts.countUsed(partId);
  req.appData.appUrl = app.locals.url;
  req.appData.mode = "printpart";
  return next();
}

var appGetCases = function(req,res,next) {
  let myName = 'appGetCases';
  logThis(myName + ": Getting all cases");
  let caseList = parts.getCases();
  req.appData.cases = [];
  caseList.forEach(function(v,i,a) {
    req.appData.cases.push(cases.find("id",v)[0]);
  })
  logThis(JSON.stringify(req.appData.cases));
  req.appData.mode = "cases";
  return next();
}

var appGetCasesJson = function(req,res,next) {
  let myName = "appGetCasesJson";
  logThis(myName + ": Request to get all cases");
  let objCases = {"cases":parts.getCases()};
  return res.json(objCases);
}

var appGetCase = function(req,res,next) {
  let myName = "appCase";
  let caseId = req.params.caseId;
  logThis(myName + ": Getting parts with case #: " + caseId);
  req.appData.mode = "case";
  req.appData.caseId = caseId;
  req.appData.caseRecord = cases.find("id",caseId)[0];
  logThis(myName + ": " + JSON.stringify(req.appData.caseRecord));
  let partsList = parts.findByCase(caseId).slice(0);
  // req.appData.parts = parts.findByCase(caseId);
  logThis(myName + ": STARTS WITH: " + JSON.stringify(partsList));
  // logThis(myName + ": MIDDLE: " + partsList.slice(0));
  logThis(myName + ": CASES: " + JSON.stringify(partsList));
  logThis(myName + ": CASE_ID: " + caseId);
  for(let c=0; c<partsList.length; c++) {
    if(partsList[c].hasOwnProperty("cases"))
    partsList[c].cases = pushMyCaseIdToTop(caseId,partsList[c].cases);
  }
  logThis(myName + ": ENDS WITH: " + JSON.stringify(partsList));
  req.appData.parts = partsList;
  // logThis(myName + ": Re-arranged: " + JSON.stringify(pushMyCaseIdToTop(caseId,)));
  return next();
}

var pushMyCaseIdToTop = function(caseId,cases) {
  let idx = cases.indexOf(caseId);
  if(idx>=0) {
    let caseRecord = cases.splice(idx,1)[0];
    cases.unshift(caseRecord);
  }
  console.log(" ** " + cases);
  return cases;
}

var appEditCaseVerified = function(req,res,next) {
  let myName = "appEditCaseVerified";
  logThis(myName + ": Request to edit case #:" + req.params.caseId);
  let caseId = req.params.caseId;
  let caseList = cases.find("id",caseId);
  if(caseList.length<1) return next(new Error("Could not find case " + caseId));
  req.appData.caseRecord = caseList[0];
  req.appData.mode = "editcase";
  return next();
}
var appEditCase = function(req,res,next) {
  let myName = "appEditCase";
  logThis(myName + ": Editing case #:" + req.body.caseid);
  logThis(JSON.stringify(req.body));
  if(!req.body.hasOwnProperty("caseid") || req.body.caseid===null || req.body.caseid===undefined) {
    logThis(myName + ": No case ID given. Punting!");
    return res.redirect('/cases/');
  }
  let caseIndex = cases.db.findIndex(function(caseRecord) {
    return caseRecord.id==req.body.caseid;
  });
  if(caseIndex==-1) return next(new Error("No case with id: " + req.body.caseid));
  cases.db[caseIndex].id = req.body.caseid;
  cases.db[caseIndex].time = parseInt(req.body.datetime);
  cases.db[caseIndex].owner = req.body.owner;
  cases.writeDb();
  return res.redirect('/case/' + req.body.caseid);
}

var appAckMsg = function(req,res,next) {
  let myName = 'appAckMsg';
  let msgId = req.params.msgId;
  logThis(myName + ": Ack'ing message: " + msgId);
  let index = req.session.messages.findIndex(function(message) {
    return message.msgId==msgId;
  });
  if(index==-1) return res.json({'msgId':false});
  if(req.session.messages.splice(index,1).length!=1) return res.json({'msgId':false});
  return res.json({'msgId':msgId});
}

var appGetDashboard = function(req,res,next) {
  let myName = "appGetDashboard";
  let oldestCases = cases.sort(function(a,b) {
    if(a.time<b.time) return -1;
    if(a.time>b.time) return 1;
    return 0;
  });
  // Get the top X
  let limit = (oldestCases.length>5) ? 5 : oldestCases.length;
  oldestCases = oldestCases.filter(function(caseRecord) {
    return (parts.findByCase(caseRecord.id).length>0);
  });
  req.appData.oldestCases = oldestCases.slice(0,limit);
  if(isAuthenticated(req)) {
    logThis(myName + ": Finding cases owned by: " + req.user.username);
    let yourCases = cases.find("owner",req.user.username);
    if(yourCases.length>0) {
      req.appData.yourCases = yourCases.filter(function(caseRecord) {
        return (parts.findByCase(caseRecord.id).length>0);
      });
    }
  }
  return next();
}

let appSetHome = function(req,res,next) {
  req.appData.mode = "home";
  return next();
}

var appSearch = function(req,res,next) {
  let myName = "appSearch";
  if(!req.query.q) return next();
  logThis(myName + ": Searching for " + req.query.q);
  req.appData.search = [];
  let searchString = req.query.q.toLowerCase();
  let results = parts.search(searchString);
  if(results.length>0) {
    results.forEach(function(v,i,a) {
      v.resultType = "part";
      v.resultIndex = i;
      req.appData.search.push(v);
    });  
  }
  results = cases.search(searchString);
  if(results.length>0) {
    results.forEach(function(v,i,a) {
      v.resultType = "case";
      v.resultIndex = i;
      req.appData.search.push(v);    
    });  
  }
  results = users.search(searchString);
  if(results.length>0) {
    results.forEach(function(v,i,a) {
      v.resultType = "user";
      v.resultIndex = i;
      req.appData.search.push(v);    
    });
  }
  req.appData.mode = "search";
  return next();
}

let makeMessage = function(obj) {
  let myName = "makeMessage";
  logThis(myName + ": Making a message for: " + JSON.stringify(obj));
  obj.msgId = Date.now();
  return obj;
}

let setMailOptions = function(to,subject,body) {
  return {
    from: app.locals.smtpFromName + "<" + app.locals.smtpFromAddr + ">",
    to: to,
    subject: subject,
    html: body
  };
}

let sendEmail = function(to,subject,body) {
  let myName = "sendEmail";
  logThis(myName + ": Attempting to send mail message to: " + to);
  if(Array.isArray(to)) to = to.join(", ");
  let mailOptions = setMailOptions(to,subject,body);
  transporter.sendMail(mailOptions, function(err,info) {
    if(err) return console.log(err);
    logThis(myName + ": Message send to " + to);
  });
  return true;
}

var errorHandler = function(err,req,res,next) {
  let myName = "errorHandler";
  logThis(myName + ":!!" + err);
  // responseString += "!!" + err;
  return res.redirect('/');
}

var appTest = function(count,skip) {
  return function(req,res,next) {
    console.log("appTest: " + count + ", SKIP: " + (skip));
    let skp = (skip) ? 'true' : 'false';
    let skpResponse = (skip) ? 'route' : null;
    // responseString += "<br>This is APPTEST: " + count + " (SKIP=" + skp + " RESPONSE: " + skpResponse + ")";
    return next(skpResponse);
  }
}

var appDump = function(req,res,next) {
  myName = 'appDump';
  let dbId = req.params.dbId;
  logThis(myName + ":~~~DUMP~~~");
  // responseString += "DUMP:";
  //responseString += "<pre>";
  if(dbId=="users") {
    logThis(JSON.stringify(users));
    // responseString += JSON.stringify(users);
  } else if(dbId=="parts") {
    logThis(JSON.stringify(parts));
    // responseString += JSON.stringify(parts);
  }
  //responseString += "</pre>";
  logThis(myName + ":~~~~~~~~~~");
  return next();
}

/**
 * ROUTES
 * / - HOME
 * /:<objects> - "manufacturers","channels",
 * /:<object>/:id
 */
app.use(appIgnoreFavicon,appStats,appStart,timeStart);

/**
 * NORMAL ROUTES
 */
app.use(setSessionData,appMessages,appHello,appGetMenu);

/**
 * AUTHENTICATION ROUTES
 */
app.get('/login',appLoginPage);
app.post('/login',passport.authenticate('local'),appRedirectToOriginalReq);
app.get('/logout',appLogout);

app.get('/secure/',appCheckAuthentication,secureApp);
app.get('/secure/',appTest(1,false),appTest(2,false));
app.get('/secure/',appTest(3,false));
app.get('/users/add',appCheckAuthentication,appAddUser);
app.get('/users/',appCheckAuthentication,appGetUsers);
app.post('/user/',appCheckAuthentication,appCreateUser);
app.post('/user/edit',appCheckAuthentication,appEditUser);
app.get('/user/:userId',appCheckAuthentication,appGetUser);
app.get('/user/edit/:userId',appCheckAuthentication,appEditUserVerified);

app.get('/parts/add',appCheckAuthentication,appAddPart);
app.get('/parts/',appGetParts);
app.get('/part/print/:partId',appCheckAuthentication,appPrintPart);
app.get('/part/checkin/:partId/case/:caseId',appCheckAuthentication,appCheckinPartVerified);
app.get('/part/checkout/:partId',appCheckAuthentication,appCheckoutPartVerified);
app.post('/part/checkinverified',appCheckAuthentication,appCheckinPart);
app.post('/part/checkoutverified',appCheckAuthentication,appCheckoutPart);
app.get('/part/edit/:partId',appCheckAuthentication,appEditPartVerified);
app.post('/part/add',appCheckAuthentication,appAddPartVerified);
app.post('/part/edit',appCheckAuthentication,appEditPart);
app.get('/part/:partId',appCheckAuthentication,appGetPart);

app.get('/cases/',appGetCases);
app.get('/case/edit/:caseId',appCheckAuthentication,appEditCaseVerified);
app.post('/case/edit',appCheckAuthentication,appEditCase);
app.get('/case/:caseId',appCheckAuthentication,appGetCase);

app.get('/messages/ack/:msgId',appCheckAuthentication,appAckMsg);

app.get('/search',appCheckAuthentication,appSearch);

app.get('/dump/:dbId',appDump);

app.get('/',appGetParts,appGetCases,appGetDashboard,appSetHome);

// app.use(appTest("end",false));
//app.use(getSessionData,timeEnd,resEnd);
app.use(timeEnd,appRender);

/**
 * Error-handling route
 */
//app.use(errorHandler);

/**
 * Start the server
 */
https.createServer(options,app).listen(app.locals.port,function() {
  console.log(app.locals.appName + " server listening on port " + app.locals.port);
});