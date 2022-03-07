const status_label = document.getElementById('register_status');
const email = document.getElementById('email');
const username = document.getElementById('username');
const password = document.getElementById('password');
const reenterPassword = document.getElementById('reenterPassword');
const submit_button = document.getElementById('submit_button');
const form = document.getElementById('myform');

const socket = io();

status_label.innerHTML = 'ENTER ALL FIELDS';

const original_onsubmit = form.onsubmit;


username.addEventListener("input", function(){
    if(username.value.length > 1){
        status_label.innerHTML = "Username Entered now enter password"
    }
    else{
        status_label.innerHTML = "Enter Username"
    }
});

password.addEventListener("input", function(){
    if(password.value.length < 1){
        status_label.innerHTML = 'Enter a Password';
    }
    else if(reenterPassword.value == ''){
        status_label.innerHTML = 'Reenter your password';
    }
});

reenterPassword.addEventListener("input", function(){
    if(reenterPassword.value === ''){
        status_label.innerHTML= 'Reenter your password';
    }
    else if(password.value != reenterPassword.value){
        status_label.innerHTML = 'Passwords do not match';
    }
    else if(password.value === reenterPassword.value){
        status_label.innerHTML = 'Passwords Match';
    }
});

function validate(){
    console.log("validating...")
    socket.emit('validate', {'email':email.value, 'username':username.value});
    return false;
}

form.addEventListener('submit', function(event){
    event.preventDefault();
    validate();
})

function validateEmail() {
    atpos = email.value.indexOf("@");
    dotpos = email.value.lastIndexOf(".");
    
    if (atpos < 1 || ( dotpos - atpos < 2 )) {
        status_label.innerHTML = "Please enter correct email ID"
        email.focus() ;
        return false;
    }
    return true ;
 }

 socket.on('form_error', data => {
    status_label.innerHTML = data;
 })

 socket.on('form_valid', data=>{
        form.submit();
 })
