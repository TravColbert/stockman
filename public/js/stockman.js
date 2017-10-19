let qrCodeBox;

function ackMessage(messageNum) {
  fetch('/messages/ack/' + messageNum,{
    method:'GET',
    credentials:'include'
  }).
    then(function(response) {
      return response.json();
    }).
    then(function(json){
      console.log(JSON.stringify(json));
      doMessage(json);
    });
}

function doMessage(json) {
  document.getElementById("msg" + json.msgId).remove();
}

function goTo(target) {
  window.location = target;
}

function qrCodeBoxExists() {
  console.log("Checking for QrCode boxes...");
  let box = document.getElementById("qrcode-box");
  if(box!=null) {
    console.log("...found one");
    return getQrCodeBox(box);
  }
  return false;
}

function getQrCodeBox(domElement) {
  qrCodeBox = new QRCode(domElement, {
    width : 100,
    height : 100
  });
  return true;
}

function makeCode() {
  let elText = document.getElementById("qrcode-url");
  console.log("URL is: " + elText.innerHTML);
	qrCodeBox.makeCode(elText.innerHTML);
}

function ready(fn) {
  if (document.readyState != 'loading'){
    fn();
  } else {
    document.addEventListener('DOMContentLoaded', fn);
  }
}

ready(function() {
  if(qrCodeBoxExists()) makeCode();
});
