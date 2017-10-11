const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const app = express();
const port = 3000;
const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
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

let responseString = '';

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
  {link:"/",text:"Home",icon:"home"},
  {link:"/secure",text:"Secured",icon:"lock_outline",secured:true},
  {link:"/users",text:"Users",icon:"people_outline",secured:true},
  {link:"/parts",text:"Parts",icon:"devices"},
  {link:"/cases",text:"Cases",icon:"assignment"},
  {link:"/update",text:"Update Database",icon:"update",secured:true},
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
    return;
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
  db:[
    {id:0,partnum:"NB.G5511.00H",description:"MAINBOARD C738T",make:"Acer",count:2,cases:["999"]},
    {id:1,partnum:"6M.G55N7.002",description:"R11 LCD Panel",make:"Acer",count:3,cases:["999","998"]},
    {id:2,partnum:"50.G55N7.007",description:"R11 LCD Cable",make:"Acer",count:3,cases:[]}
  ]
};

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
    let x=this.db.length;
    while(this.find("id",x).length>0) {
      x++;
    }
    this.db.push({
      id:x,
      username:userObj.username,
      password:userObj.password
    });
    return;
  },
  db:[
    {id:0,username:'admin',password:'test123!',cases:[]}
  ]
};

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
      if(user.password!=password) {
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
  responseString = '';
  req.appData = {};
  req.appData.title = "Stock-Man";
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
    // return;
  }
  logThis(myName + ": Found session for: " + JSON.stringify(req.user));
  logThis(myName + ": session is authenticated");
  // req.appData.user = req.user ? req.user : "Hi!";
  return next();
}

var timeStart = function(req,res,next) {
  let myName = "timeStart";
  logThis(myName);
  req.appData.startTime = Date.now();
  return next();
}

var appMenu = function(req,res,next) {
  let makeMenuItem = function(menuItem) {
    return "<li><a href='" + menuItem.link + "'>" + menuItem.text + "</a></li>";
  }
  let myName = "appMenu";
  responseString += "<ul>";
  menu.forEach(function(v,i,a) {
    if(!v.hasOwnProperty("secured")) {
      responseString += makeMenuItem(v);
    } else {
      if(v.secured && req.user) responseString += makeMenuItem(v);
      if(!v.secured && !req.user) responseString += makeMenuItem(v);
    }
  });
  responseString += "</ul>";
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

var appGetMenuJson = function(req,res,next) {
  let myName = "appGetMenuJson";
  let objMenu = {"menu":[]};
  let makeMenuItem = function(menuItem) {
    return {"link":menuItem.link,"text":menuItem.text,"icon":menuItem.icon};
  };
  menu.forEach(function(v) {
    if(!v.hasOwnProperty("secured")) {
      objMenu.menu.push(makeMenuItem(v));
    } else {
      if(v.secured && req.user) objMenu.menu.push(makeMenuItem(v));
      if(!v.secured && !req.user) objMenu.menu.push(makeMenuItem(v));
    }
  });
  return res.json(objMenu);
}

var helloWorld = function(req,res,next) {
  var myName = "root";
  logThis(myName + ": User: " + req.user);
  let audience = req.user || "World";
  responseString += "Hello " + audience;
  req.appData.user = req.user;
  return next();
}

var updateApp = function(req,res,next) {
  var myName = "update";
  logThis(myName);
  responseString += "<br>\nI'm going to update my records";
  return next();
}

var secureApp = function(req,res,next) {
  var myName = "secureApp";
  logThis(myName);
  responseString += "<br>\n!!! SUPER SECURE DATA !!!";
  return next();
}

var getSessionData = function(req,res,next) {
  let myName = "getSessionData";
  if(req.session.views) responseString += "<br>\nViews: " + req.session.views;
  return next();
}

var setSessionData = function(req,res,next) {
  let myName = "setSessionData";
  if(!req.session.views) req.session.views = 0;
  req.session.views++;
  return next();
}

var timeEnd = function(req,res,next) {
  let myName = "timeEnd";
  logThis(myName);
  req.appData.stopTime = Date.now();
  return next();
}

var resEnd = function(req,res) {
  let myName = "resEnd";
  logThis(myName + ": ^^^^^^^^^^");
  return res.send(req.startTime + "<br>\n" + responseString + "<br>\n" + req.stopTime);
  // return;
}

var appRender = function(req,res) {
  let myName = "appRender";
  let templateFile = req.appData.mode || "index";
  logThis(myName + ": Sending off to template: " + templateFile);
  logThis(myName + ": " + JSON.stringify(req.appData));
  res.render(templateFile,req.appData);
}

var appLoginPage = function(req,res) {
  logThis("...(sending login page)...");
  if(process.platform=="win32") {
    // Windows:
    return res.sendFile('/public/login.html',{root:'C:/Users/Travis/Downloads/Node/'});
  } else {
    // Linux:
    return res.sendFile('/public/login.html',{root:'/home/travis/Downloads/Projects/stockman/'});
  }
}

var appLogout = function(req,res,next) {
  let myName = "appLogout";
  logThis(myName);
  req.logout();
  return res.redirect('/');
  //return;
}

var appRedirectToOriginalReq = function(req,res) {
  let myName = "appRedirectToOriginalReq";
  let redirectTo = req.session.originalReq || '/';
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

let makeUserJson = function(user) {
  return {"id":user.id,"username":user.username};
}

var appGetUsersJson = function(req,res,next) {
  let myName = "appGetUsersJson";
  let objUsers = {"users":[]};
  users.db.forEach(function(v) {
    objUsers.users.push(makeUserJson(v));
  });
  return res.json(objUsers);
}

var appGetUser = function(req,res,next) {
  let myName = "appGetUser";
  let user;
  let userId = req.params.userId;
  logThis(myName + ": Getting user with ID: " + userId);
  responseString += "<ul>";
  users.findById(userId,function(err,user) {
    if(!err) responseString += "<li><div>Username: " + user.username + "</div> <div>PW: " + user.password + "</div> <div>ID: " + user.id + "</div></li>";
  });
  responseString += "</ul>";
  return next();
}

var appGetUserJson = function(req,res,next) {
  let myName = "appGetUserJson";
  let userId = req.params.userId;
  let objUsers = {"users":[]};
  logThis(myName + ": Getting user with id: " + userId);
  users.findById(userId,function(err,user) {
    if(!err) objUsers.users.push(makeUserJson(user));
  });
  return res.json(objUsers);
}

var appFormCreateUser = function(req,res,next) {
  let myName = "appFormCreateUser";
  responseString +=`
<form action="/user" method="post">
<div id="prompt">New User</div>
<div><input type="text" name="username" id="username" placeholder="Username" /></div>
<div><input type="password" name="password" id="password" placeholder="Passphrase" /></div>
<input type="submit" id="submit" value="Create User" />
</form>`;
  return next();
}

var appCreateUser = function(req,res,next) {
  let myName = "appCreateUser";
  logThis(myName + ": Request to create user: " + JSON.stringify(req.body));
  users.add(req.body);
  res.redirect('/users');
  return;
}

var appGetParts = function(req,res,next) {
  let myName = "appGetParts";
  logThis(myName + ": Request to get ALL PARTS: " + JSON.stringify(req.body));
  responseString += "Parts";
  responseString += "<br>" + parts.db.length + " Parts found";
  responseString += "<ul>";
  parts.db.forEach(function(part,i,a) {
    logThis(myName + ": Examining part: " + part.id);
    let message = '';
    let freeParts = parts.countFree(part.id);
    let usedParts = parts.countUsed(part.id);
    if((freeParts + usedParts)!=part.count) message = '<span class="error">There seems to be a descrepancy in the parts stock amount</span>';
    responseString += "<li><a href='/part/" + part.id + "'>" + part.make + ": " + part.partnum + ": " + part.description + " (Available:" + freeParts + " checked-out:" + usedParts + " Total stock:" + part.count + ")</a> " + message + "</li>";
  });
  responseString += "</ul>";
  return next();
}

var appGetPartsJson = function(req,res,next) {
  let myName = "appGetPartsJson";
  logThis(myName + ": Request to get ALL PARTS: " + JSON.stringify(req.body));
  let objParts = {"parts":[]};
  parts.db.forEach(function(v) {
    objParts.parts.push(v);
  });
  return res.json(objParts);
}

var appGetPartsByCaseJson = function(req,res,next) {
  let myName = "appGetPartsByCaseJson";
  let caseId = req.params.caseId;
  let objParts = {"parts":[]};  
  logThis(myName + ": Getting parts with case #: " + caseId);
  parts.findByCase(caseId).forEach(function(v) {
    objParts.parts.push(v);
  });
  return res.json(objParts);
}

var appGetPart = function(req,res,next) {
  let myName = "appGetPart";
  let partId = req.params.partId;
  logThis(myName + ": Getting part with ID: " + partId);
  responseString += "<ul>";
  let partList = parts.find("id",partId);
  partList.forEach(function(part,i,a) {
    logThis(myName + ": " + JSON.stringify(part));
    let message = '';
    let freeParts = parts.countFree(part.id);
    let usedParts = parts.countUsed(part.id);
    if((freeParts + usedParts)!=part.count) message = '<span class="error">There seems to be a descrepancy in the parts stock amount</span>';
    responseString += `
    <li>
      <div>Description: ${part.description}</div>
      <div>Make: ${part.make}</div>
      <div>Manufacturer Part Number: ${part.partnum}</div>
      <div>ID: ${part.id}</div>
      <div>Stock:
        <div>Total: ${part.count}</div>
        <div>Available: ${freeParts}</div>
        <div>Used: ${usedParts}</div>
        <div>${message}</div>
      </div>
      <div>`;
    if(freeParts<part.count) responseString += `<a href="/parts/checkin/${partId}">+</a>`;
    if(freeParts) responseString += `<a href="/parts/checkout/${partId}">-</a>`;
    responseString += "</div></li>";
  })
  responseString += "</ul>";
  return next();
}

var appGetPartJson = function(req,res,next) {
  let myName = "appGetPartJson";
  let partId = req.params.partId;
  let objParts = {"parts":[]};
  logThis(myName + ": Getting part with ID: " + partId);
  parts.find("id",partId).forEach(function(v) {
    objParts.parts.push(v);
  });
  return res.json(objParts);
}

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

var appGetAddPartUi = function(req,res,next) {
  let myName = "appGetAddPartUi";
  logThis(myName);
  responseString += "<a href='/parts/add'>Add Part</a>";
  return next();
}

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

var appCreatePart = function(req,res,next) {
  let myName = "appCreatePart";
  logThis(myName + ": Request to create part: " + JSON.stringify(req.body));
  parts.add(req.body);
  res.redirect('/parts/add');
  return;
}

var appFormEditPart = function(req,res,next) {
  let myName = "appFormEditPart";
  let partId = req.params.partId;
  logThis(myName + ": Request to edit part: " + req.params.partId + " " + JSON.stringify(req.body));
  let part = parts.find('id',partId);
  if(part.length<1) return next(new Error("Could not find part for editing"));
  part = part[0];
  logThis(myName + ": " + JSON.stringify(part));
  let dateNow = Date.now();
  // We need to build a new form here to verify
  // /parts/checkinverify/:partId
  responseString +=`
  <form action="/parts/editverified" method="post">
  <input type="hidden" name="partid" id="partid" value="${partId}" />
  <div id="prompt">Edit Part</div>
  <div><input type="text" name="partnum" id="partnum" placeholder="Manufacturer Part Number" value="${part.partnum}" />${part.partnum}</div>
  <div><input type="text" name="description" id="description" placeholder="Description" value="${part.description}" />${part.description}</div>
  <div><input type="text" name="make" id="make" placeholder="Manufacturer" value="${part.make}" />${part.make}</div>
  <div><input type="text" name="count" id="count" placeholder="Current Count" value="${part.count}" />${part.count}</div>
  <input type="submit" id="submit" value="Submit" />
  </form>`;
  next();
}

var appEditPartVerify = function(req,res,next) {
  let myName = "appEditPartVerify";
  logThis(myName + ": Verifying modification of part: " + req.body.partid);

}

/**
 * Perform basic checks on part check-in. Then proceed
 *
 * @param {*} req
 * @param {*} res
 * @param {*} next
 */
var appCheckinPartVerify = function(req,res,next) {
  let myName = "appCheckinPartVerify";
  let partId = req.params.partId;
  logThis(myName + ": Request to verify check-in of part: " + partId);
  // Verify part exists, fetch description and count
  let part = parts.find("id",partId);
  if(part.length<1) return next(new Error("Could not find part for check-in"));
  part = part[0];
  logThis(myName + ": " + JSON.stringify(part));
  let dateNow = Date.now();
  // We need to build a new form here to verify
  // /parts/checkinverify/:partId
  responseString +=`
  <form action="/parts/checkinverified" method="post">
  <input type="hidden" name="partid" id="partid" value="${partId}" />
  <div id="prompt">Verify Check-In</div>
  <div><input type="hidden" name="date" id="date" placeholder="Date" value="${dateNow}" />${dateNow}</div>
  <div><input type="hidden" name="description" id="description" placeholder="Description" value="${part.description}" />${part.description}</div>
  <div><input type="hidden" name="make" id="make" placeholder="Manufacturer" value="${part.make}" />${part.make}</div>
  <div><input type="hidden" name="count" id="count" placeholder="Current Count" value="${part.count}" />${part.count}</div>
  <div><input type="text" name="casenum" id="casenum" placeholder="Case #" /></div>
  <input type="submit" id="submit" value="Checkin Part" />
  </form>`;
  next();
}

var appCheckinPart = function(req,res,next) {
  let myName = "appCheckinPart";
  logThis(myName + ": Request to check in part: " + req.body.partid + " in case #: " + req.body.casenum);
  if(parts.checkin(req.body.partid,req.body.casenum)) {
    logThis(myName + ": Redirecting to: /part/" + req.body.partid);
    return res.redirect('/part/' + req.body.partid);
  }
  return next(new Error('Something went wrong :-('));
}

var appCheckoutPartVerify = function(req,res,next) {
  let myName = "appCheckoutPartVerify";
  let partId = req.params.partId;
  logThis(myName + ": Request to verify check-out of part: " + partId);
  // Verify part exists, fetch description and count
  var part = parts.find("id",partId);
  if(part.length<1) return next(new Error("Could not find part for check-out"));
  part = part[0];
  logThis(myName + ": " + JSON.stringify(part));
  let dateNow = Date.now();
  // We need to build a new form here to verify
  // /parts/checkinverify/:partId
  responseString +=`
  <form action="/parts/checkoutverified" method="post">
  <input type="hidden" name="partid" id="partid" value="${partId}" />
  <div id="prompt">Verify Check-Out</div>
  <div><input type="hidden" name="date" id="date" value="${dateNow}" />${dateNow}</div>
  <div><input type="hidden" name="description" id="description" value="${part.description}" />${part.description}</div>
  <div><input type="hidden" name="make" id="make" value="${part.make}" />${part.make}</div>
  <div><input type="hidden" name="count" id="count" value="${part.count}" />${part.count}</div>
  <div><input type="text" name="casenum" id="casenum" placeholder="Case #" /></div>
  <input type="submit" id="submit" value="Checkout Part" />
  </form>`;
  next();
}

var appCheckoutPart = function(req,res,next) {
  let myName = "appCheckoutPart";
  logThis(myName + ": Request to check out part: " + req.body.partid);
  if(parts.checkout(req.body.partid,req.body.casenum)) {
    return res.redirect('/part/' + req.body.partid);
  }
  return next(new Error('Something went wrong :-('));
}

var appGetCases = function(req,res,next) {
  let myName = 'appGetCases';
  let caseList = parts.getCases();
  responseString += "Cases";
  responseString += "<br>Opened cases:" + caseList.length + " (cases with parts still checked-out)";
  if(caseList.length==0) return next();
  responseString += "<ul>";
  caseList.forEach(function(v,i,a) {
    let partCount = parts.findByCase(v).length;
    responseString += "<li><a href='/case/" + v + "'>" + v + "</a> (" + partCount + " part(s) checked-out)</li>";
  });
  responseString += "</ul>";
  return next();
}

var appGetCasesJson = function(req,res,next) {
  let myName = "appGetCasesJson";
  logThis(myName + ": Request to get all cases");
  let objCases = {"cases":parts.getCases()};
  // parts.getCases();
  // parts.db.forEach(function(v) {
  //   objParts.parts.push(v);
  // });
  return res.json(objCases);
}

var appGetCase = function(req,res,next) {
  let myName = "appCase";
  let caseId = req.params.caseId;
  logThis(myName + ": Getting parts with case #: " + caseId);
  responseString += "<br>Parts for Case #" + caseId;
  responseString += "<ul>";
  let partList = parts.findByCase(caseId);
  partList.forEach(function(part,i,a) {
    let message = '';
    let freeParts = parts.countFree(part.id);
    let usedParts = parts.countUsed(part.id);
    if((freeParts + usedParts)!=part.count) message = '<span class="error">There seems to be a descrepancy in the parts stock amount</span>';
    responseString += "<li><a href='/part/" + part.id + "'>" + part.make + ": " + part.description + " (Available:" + freeParts + " checked-out:" + usedParts + " Total stock:" + part.count + ")</a> " + message + "</li>";
  });
  responseString += "</ul>";
  return next();
}

var errorHandler = function(err,req,res,next) {
  let myName = "errorHandler";
  logThis(myName + ":!!" + err);
  responseString += "!!" + err;
  return res.redirect('/');
}

var appTest = function(count,skip) {
  return function(req,res,next) {
    console.log("appTest: " + count + ", SKIP: " + (skip));
    let skp = (skip) ? 'true' : 'false';
    let skpResponse = (skip) ? 'route' : null;
    responseString += "<br>This is APPTEST: " + count + " (SKIP=" + skp + " RESPONSE: " + skpResponse + ")";
    return next(skpResponse);
  }
}

var appDump = function(req,res,next) {
  myName = 'appDump';
  let dbId = req.params.dbId;
  logThis(myName + ":~~~DUMP~~~");
  responseString += "DUMP:";
  //responseString += "<pre>";
  if(dbId=="users") {
    logThis(JSON.stringify(users));
    responseString += JSON.stringify(users);
  } else if(dbId=="parts") {
    logThis(JSON.stringify(parts));
    responseString += JSON.stringify(parts);
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
 * AUTHENTICATION ROUTES
 */
app.get('/login',appLoginPage);
app.post('/login',passport.authenticate('local'),appRedirectToOriginalReq);
app.get('/logout',appLogout);

/**
 * NORMAL ROUTES
 */
// app.use(setSessionData,helloWorld,appMenu);
app.use(setSessionData,helloWorld,appGetMenu);

// app.get('/test',appGetMenu,function(req,res) {
//   console.log("Rendering the template:");
//   console.log(JSON.stringify(req.appData));
//   res.render('index',req.appData);
// });

// app.get('/menu/',appGetMenuJson);

app.get('/secure/',appCheckAuthentication,secureApp);
app.get('/secure/',appTest(1,false),appTest(2,false));
app.get('/secure/',appTest(3,false));
app.get('/update/',updateApp);
// The HTML response
// app.get('/users/',appCheckAuthentication,appGetUsers,appFormCreateUser);
// The JSON response
app.get('/users/',appCheckAuthentication,appGetUsers);
// app.get('/user/:userId',appCheckAuthentication,appGetUser);
app.get('/user/:userId',appCheckAuthentication,appGetUserJson);
app.post('/user/',appCheckAuthentication,appCreateUser);

// app.get('/parts/',appGetParts,appGetAddPartUi);
app.get('/parts/',appGetPartsJson);
app.get('/parts/add',appCheckAuthentication,appFormCreatePart,appGetParts);
app.get('/parts/checkin/:partId',appCheckAuthentication,appCheckinPartVerify,appGetParts);
app.get('/parts/checkout/:partId',appCheckAuthentication,appCheckoutPartVerify,appGetParts);
app.post('/parts/checkinverified',appCheckAuthentication,appCheckinPart);
app.post('/parts/checkoutverified',appCheckAuthentication,appCheckoutPart);
// app.get('/part/:partId',appCheckAuthentication,appGetPart);
app.get('/part/:partId',appCheckAuthentication,appGetPartJson);
app.post('/part/',appCheckAuthentication,appCreatePart);

app.get('/cases/',appGetCasesJson);
app.get('/case/:caseId',appCheckAuthentication,appGetPartsByCaseJson);

app.get('/dump/:dbId',appDump);

// app.use(appTest("end",false));
//app.use(getSessionData,timeEnd,resEnd);
app.use(getSessionData,timeEnd,appRender);

/**
 * Error-handling route
 */
app.use(errorHandler);

/**
 * Start the server
 */
app.listen(port, function() {
  console.log("Server listening on port",port);
});
