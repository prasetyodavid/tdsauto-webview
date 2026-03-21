function toggleMenu(){
    document.getElementById("sidebar").classList.toggle("active");
}

// Smooth transition saat klik link
document.addEventListener("DOMContentLoaded", function(){
    const links = document.querySelectorAll("a");

    links.forEach(link=>{
        if(link.getAttribute("href").includes(".html")){
            link.addEventListener("click", function(e){
                e.preventDefault();
                document.body.classList.add("fade-out");
                setTimeout(()=>{
                    window.location = this.href;
                },300);
            });
        }
    });
});

// ===== BBFS GENERATOR =====
function generateBBFS(){

    const digit = parseInt(document.getElementById("bbfsInput").value);
    const resultBox = document.getElementById("bbfsResult");

    if(isNaN(digit) || digit < 2 || digit > 10){
        resultBox.innerHTML = "Masukkan angka 2 - 10";
        return;
    }

    let numbers = [];

    while(numbers.length < digit){
        let randomNum = Math.floor(Math.random() * 10);
        if(!numbers.includes(randomNum)){
            numbers.push(randomNum);
        }
    }

    resultBox.innerHTML = numbers.join(" ");
}

function clearBBFS(){

let input = document.getElementById("bbfsInput");
let resultBox = document.getElementById("bbfsResult");
let resultArea = document.getElementById("resultArea");

if(input){
input.value = "";
}

if(resultBox){
resultBox.innerHTML = "";
}

if(resultArea){
resultArea.value = "";
}

}