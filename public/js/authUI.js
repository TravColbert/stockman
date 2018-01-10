let getAuthElements = function() {
  return document.getElementsByClassName("authUI");
}

let authUI = function(list) {
  for(let c=0;c<list.length;c++) {
    console.log(list[c].dataset.fetch);
    requestElement(list[c]);
  }
}

let requestElement = function(parentElement) {
  // .dataset.fetch
  let requestObj = {
    method:'POST',
    credentials:'include'
  };
  if(parentElement.dataset.hasOwnProperty('params')) requestObj.body = JSON.stringify({params:parentElement.dataset.params});
  fetch('/authorizedelements/' + parentElement.dataset.fetch, requestObj).
  then(function(response) {
    return response.json();
  }).
  then(function(elementJson) {
    if(elementJson.hasOwnProperty('error')) {
      console.log(elementJson.error);
    } else {
      console.log(elementJson);
      elementJson.parent = parentElement;
      let user_button = new Laminar.Widget(elementJson);
      var attributes = Object.keys(parentElement.dataset);
      for(c in attributes) {
        if(attributes[c]!="fetch") {
          user_button.set(attributes[c],parentElement.dataset[attributes[c]]);
        }
      }
    }
  })
}
function ready(fn) {
  if (document.readyState != 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

ready(function() {
  // Make a list of components that need to be authorized before enabling
  // Components will probably be a placeholder DIV
  let listOfElements = getAuthElements();
  console.log(listOfElements.length);
  authUI(listOfElements);
});
