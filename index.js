const fs = require('fs');
const https = require('https');
const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const app = express();
const options = {
  key: fs.readFileSync('tls/stockr-key.pem'),
  cert: fs.readFileSync('tls/stockr.crt')
}
const port = 3000;
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const bcrypt = require('bcryptjs');
const appName = "Stockr";
const usersDbFile = "db/users.db";
const partsDbFile = "db/parts.db";
let sessionConfig = {
  secret:'yoyo!',
  resave:false,
  saveUninitialized:false
};

/**
 * Configuration
 */
// Template Engine setup:
app.set('views','./views');
app.set('view engine','pug');
app.use(express.static('public'));
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
  /*{link:"/",text:"Home",icon:"home"},*/
  /*{link:"/secure",text:"Secured",icon:"lock_outline",secured:true},*/
  {link:"/parts",text:"Parts",icon:"devices"},
  {link:"/cases",text:"Cases",icon:"assignment"},
  /*{link:"/update",text:"Update Database",icon:"update",secured:true},*/
  {link:"/users",text:"Users",icon:"people_outline",secured:true},
  {link:"/about",text:"About",icon:"info_outline"},
  {link:"/login",text:"Log In",icon:"verified_user",secured:false},
  {link:"/logout",text:"Log Out",icon:"highlight_off",secured:true},
];

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
      count:part.count,
      cases:[]
    });
    return x;
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
   * To check-out : add a case number to the array
   * To check-in : remove a case number from the array
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
    fs.readFile(partsDbFile,'utf8',function(err,data) {
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
    fs.writeFile(partsDbFile,JSON.stringify(this.db),function(err) {
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
        req.session.messages.push({type:"warn",text:"Passwords do not match"});
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
      password:userObj.password
    },this);
    return true;
  },
  readDb:function() {
    let methodName = "readDb";
    console.log(this.myName + ": " + methodName + ": Attempting read of stored users data...");
    fs.readFile(usersDbFile,'utf8',function(err,data) {
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
    fs.writeFile(usersDbFile,JSON.stringify(this.db),function(err) {
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
    cb(null,user.username);
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
  req.appData.title = appName;
  // logThis(myName + ": Clearing appData/session messages");
  req.appData.messages = [];
  // req.session.messages = [];
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

var appCheckAuthentication = function(req,res,next) {
  let myName = "appCheckAuthentication";
  logThis(myName + ": Starting authentication check...");
  if(req.session.cookie) {
    logThis(myName + ": Current session data: " + JSON.stringify(req.session));
  }
  if(!req.user) {
    logThis(myName + ": Could not find user for session");
    logThis(myName + ": session is NOT authenticated");
    logThis(myName + ": header status: " + (res.headersSent));
    return res.redirect('/login');
  }
  logThis(myName + ": Found session for: " + JSON.stringify(req.user));
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
  var myName = "root";
  logThis(myName + ": User: " + req.user);
  let audience = req.user || "World";
  req.appData.account = req.user;
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
  logThis(myName + ": " + JSON.stringify(req.appData));
  res.render(templateFile,req.appData);
}

var appLoginPage = function(req,res,next) {
  logThis("...(sending login page)...");
  // let salt = bcrypt.genSaltSync(10);
  req.appData.mode = "login";
  req.appData.secretSauce = "blahblahblah";
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
    req.appData.users.push({id:user.id,username:user.username});
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
      req.session.messages.push({type:"err",text:"Error getting user with ID:" + userId});
    } else if(!user) {
      req.session.messages.push({type:"warn",text:"No user found with ID:" + userId});
    } else {
      req.session.messages.push({type:"succ",text:"Found user ID:" + userId + " " + JSON.stringify(user)});
      req.session.messages.push({type:"succ",text:"Found user ID:" + userId + " " + JSON.stringify(user)});
      delete user.password;
      req.appData.user = user;
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

var appGetParts = function(req,res,next) {
  let myName = "appGetParts";
  logThis(myName + ": Request to get ALL PARTS: " + JSON.stringify(req.body));
  req.appData.parts = parts.db;
  req.appData.mode = "parts";
  req.appData.parts.forEach(function(part,i,a) {
    logThis(myName + ": Calculating stock levels for part: " + part.id);
    part.free = parts.countFree(part.id);
    part.used = parts.countUsed(part.id);
  });
  return next();
}

// var appGetPartsJson = function(req,res,next) {
//   let myName = "appGetPartsJson";
//   logThis(myName + ": Request to get ALL PARTS: " + JSON.stringify(req.body));
//   let objParts = {"parts":[]};
//   parts.db.forEach(function(v) {
//     objParts.parts.push(v);
//   });
//   return res.json(objParts);
// }

// var appGetPartsByCaseJson = function(req,res,next) {
//   let myName = "appGetPartsByCaseJson";
//   let caseId = req.params.caseId;
//   let objParts = {"parts":[]};
//   logThis(myName + ": Getting parts with case #: " + caseId);
//   parts.findByCase(caseId).forEach(function(v) {
//     objParts.parts.push(v);
//   });
//   return res.json(objParts);
// }

var appGetPart = function(req,res,next) {
  let myName = "appGetPart";
  let partId = req.params.partId;
  logThis(myName + ": Getting part with ID: " + partId);
  // responseString += "<ul>";
  // let partList = parts.find("id",partId);
  req.appData.part = parts.find("id",partId)[0];
  req.appData.part.free = parts.countFree(partId);
  req.appData.part.used = parts.countUsed(partId);
  req.appData.mode = "part";
  return next();
}

// var appGetPartJson = function(req,res,next) {
//   let myName = "appGetPartJson";
//   let partId = req.params.partId;
//   let objParts = {"parts":[]};
//   logThis(myName + ": Getting part with ID: " + partId);
//   parts.find("id",partId).forEach(function(v) {
//     objParts.parts.push(v);
//   });
//   return res.json(objParts);
// }

var appFormSearchPart = function(req,res,next) {
  let myName = "appFormSearchPart";
  logThis(myName);
  responseString +=`
  <form action="/search" method="post">
  <div id="prompt">Search Parts</div>
  <div><input type="text" name="description" id="description" placeholder="Description" /></div>
  <div><input type="text" name="partnum" id="partnum" placeholder="Manufacturer Part Number" /></div>
  <div><input type="text" name="make" id="make" placeholder="Manufacturer" /></div>
  <div><input type="text" name="count" id="count" placeholder="Current Count" /></div>
  <input type="submit" id="submit" value="Create Part" />
  </form>`;
  return next();
}

// var appGetAddPartUi = function(req,res,next) {
//   let myName = "appGetAddPartUi";
//   logThis(myName);
//   responseString += "<a href='/parts/add'>Add Part</a>";
//   return next();
// }

var appFormCreatePart = function(req,res,next) {
  let myName = "appFormCreateUser";
  logThis(myName + ": Building create part form");
  responseString +=`
<form action="/part" method="post">
<div id="prompt">Add New Part</div>
<div><input type="text" name="description" id="description" placeholder="Description" /></div>
<div><input type="text" name="partnum" id="partnum" placeholder="Manufacturer Part Number" /></div>
<div><input type="text" name="make" id="make" placeholder="Manufacturer" /></div>
<div><input type="text" name="count" id="count" placeholder="Current Count" /></div>
<input type="submit" id="submit" value="Create Part" />
</form>`;
  return next();
}

// var appCreatePart = function(req,res,next) {
//   let myName = "appCreatePart";
//   logThis(myName + ": Request to create part: " + JSON.stringify(req.body));
//   parts.add(req.body);
//   res.redirect('/parts/add');
//   return;
// }

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
  let duplicatePartNumber = parts.db.findIndex(function(partRecord) {
    console.log(myName + ": " + partRecord.partnum + " : " + req.body.partnum);
    return partRecord.partnum==req.body.partnum;
  });
  console.log(myName + ": " + duplicatePartNumber);
  if(duplicatePartNumber>-1) {
    req.session.messages.push({type:"err",text:"Can't add part with duplicate manufacturer's number"});
    // return next(new Error("Attempting to add part with duplicate manufacturer's number"));
    return res.redirect('/parts/');
  }
  let partId = parts.add({
    partnum:req.body.partnum,
    description:req.body.description,
    make:req.body.make,
    count:req.body.count
  });
  if(!partId) {
    req.session.messages.push({type:"warn",text:"Could not create new part"});
    return req.redirect("/part/");
  }
  parts.writeDb();
  req.session.messages.push({type:"success",text:"New part added"});
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
  next();
}

var appCheckinPart = function(req,res,next) {
  let myName = "appCheckinPart";
  logThis(myName + ": Request to check in part: " + req.body.partid + " in case #: " + req.body.casenum);
  if(parts.checkin(req.body.partid,req.body.caseid)) {
    parts.writeDb();
    logThis(myName + ": Redirecting to: /part/" + req.body.partid);
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
  next();
}

var appCheckoutPart = function(req,res,next) {
  let myName = "appCheckoutPart";
  logThis(myName + ": Request to check out part: " + req.body.partid);
  if(parts.checkout(req.body.partid,req.body.caseid)) {
    parts.writeDb();
    return res.redirect('/part/' + req.body.partid);
  }
  return next(new Error('Something went wrong :-('));
}

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
  parts.db[partIndex].description = req.body.description;
  parts.db[partIndex].make = req.body.make;
  parts.db[partIndex].count = req.body.count;
  parts.writeDb();
  return res.redirect('/part/' + req.body.partid);
}

var appGetCases = function(req,res,next) {
  let myName = 'appGetCases';
  logThis(myName + ": Getting all cases");
  req.appData.cases = parts.getCases();
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
  req.appData.parts = parts.findByCase(caseId);
  return next();
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
// app.use(setSessionData,appHello,appMenu);
app.use(setSessionData,appMessages,appHello,appGetMenu);

/**
 * AUTHENTICATION ROUTES
 */
app.get('/login',appLoginPage);
app.post('/login',passport.authenticate('local'),appRedirectToOriginalReq);
app.get('/logout',appLogout);

// app.get('/test',appGetMenu,function(req,res) {
//   console.log("Rendering the template:");
//   console.log(JSON.stringify(req.appData));
//   res.render('index',req.appData);
// });

// app.get('/menu/',appGetMenuJson);

app.get('/secure/',appCheckAuthentication,secureApp);
app.get('/secure/',appTest(1,false),appTest(2,false));
app.get('/secure/',appTest(3,false));
// app.get('/update/',updateApp);
// The HTML response
// app.get('/users/',appCheckAuthentication,appGetUsers,appFormCreateUser);
// The JSON response
app.get('/users/add',appCheckAuthentication,appAddUser)
app.get('/users/',appCheckAuthentication,appGetUsers);
app.post('/user/',appCheckAuthentication,appCreateUser);
app.get('/user/:userId',appCheckAuthentication,appGetUser);

app.get('/parts/add',appCheckAuthentication,appAddPart);
app.get('/parts/',appGetParts);
app.get('/part/checkin/:partId/case/:caseId',appCheckAuthentication,appCheckinPartVerified);
app.get('/part/checkout/:partId',appCheckAuthentication,appCheckoutPartVerified);
app.post('/part/checkinverified',appCheckAuthentication,appCheckinPart);
app.post('/part/checkoutverified',appCheckAuthentication,appCheckoutPart);
app.get('/part/edit/:partId',appCheckAuthentication,appEditPartVerified);
app.post('/part/add',appCheckAuthentication,appAddPartVerified);
app.post('/part/edit',appCheckAuthentication,appEditPart);
app.get('/part/:partId',appCheckAuthentication,appGetPart);

app.get('/cases/',appGetCases);
app.get('/case/:caseId',appCheckAuthentication,appGetCase);

app.get('/dump/:dbId',appDump);

// app.use(appTest("end",false));
//app.use(getSessionData,timeEnd,resEnd);
app.use(timeEnd,appRender);

/**
 * Error-handling route
 */
app.use(errorHandler);

/**
 * Start the server
 */
https.createServer(options,app).listen(port,function() {
  console.log("Server listening on port",port);
});

// app.listen(port, function() {
// });
