document.addEventListener("DOMContentLoaded",() => {
    const loginForm = document.getElementById("loginForm");
    if (loginForm) {
document.getElementById("loginForm").addEventListener("submit", async function(event) {
    event.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    console.log(JSON.stringify({"username":username,"password":password}))
    const response = await fetch("http://localhost:8001/auth/login", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ username, password })
    });

    const data = await response.json();
    console.log(data)

    if (response.ok) {
        localStorage.setItem("user", data.username);
        window.location.href = "./Home.html"; // Redirect to a dashboard page
    } else {
        console.log(data.message || "Invalid credentials");
    }
});
    }
})

function uploadFile() {
    fetch("http://localhost:8001/protected-route", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ username:"om123", password:"123" })
    });
    const fileInput = document.getElementById("fileInput");
    if (!fileInput.files.length) {
        alert("Please select a file.");
        return;
    }

    const file = fileInput.files[0];

    if (file.type !== "text/plain") {
        alert("Only .txt files are allowed.");
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        const fileContent = event.target.result;

        fetch("http://localhost:8001/scanUpload", {
            method: "POST",
            headers: {
                "Content-Type": "text/plain",
                "file-name": file.name 
            },
            credentials: "include", 
            body: fileContent
        })
        .then(response => response.json())
        .then(data => {
            console.log("Upload response:", data);
        })
        .catch(error => console.error("Upload error:", error));
    };

    reader.readAsText(file);
}
