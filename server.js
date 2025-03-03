const express = require("express");
const fs = require("fs");
const bcrypt = require("bcrypt");
const session = require("express-session");
const path = require("path");
const { json } = require("stream/consumers");
const cors = require("cors")

const app = express();
const database = "users.json";
const PORT = 8001;

app.use(cors({
    origin:"http://127.0.0.1:5500",
    credentials: true
}
))
app.use(express.json());
app.use(express.raw({ type: "text/plain", limit: "5mb" }));
app.use(express.urlencoded({extended:true}))
app.use(session({
    secret: "Cathago@2025",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly:true, sameSite:"lax" }
}));

const readUsers = () => {
    try {
        const data = fs.readFileSync(database, "utf8").trim();
        
        if (!data) return [];
        
        const parsedData = JSON.parse(data);
        
        return Array.isArray(parsedData) ? parsedData : [];
    } catch (error) {
        console.error("Error reading users.json:", error);
        return [];
    }
};

const writeUsers = (users) => {
    try {
        fs.writeFileSync(database, JSON.stringify(users, null));
    } catch (error) {
        console.error("Error writing users.json:", error);
    }
};

function updateUser(username, newUserData) {
    let users = readUsers(); // Read current users
    const index = users.findIndex(user => user.username === username);

    if (index !== -1) {
        users[index] = { ...users[index], ...newUserData }; 
        writeUsers(users);
        console.log(`User ${username} updated successfully.`);
    } else {
        console.log(`User with username ${username} not found.`);
    }
}

function levenshteinDistance(str1, str2) {
    const len1 = str1.length;
    const len2 = str2.length;

    const dp = Array(len1 + 1).fill(null).map(() => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) {
        dp[i][0] = i;
    }
    for (let j = 0; j <= len2; j++) {
        dp[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;

            dp[i][j] = Math.min(
                dp[i - 1][j] + 1,
                dp[i][j - 1] + 1,
                dp[i - 1][j - 1] + cost
            );
        }
    }

    return dp[len1][len2];
}

function similarity(str1, str2) {
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1.0;

    const distance = levenshteinDistance(str1, str2);
    return (1 - distance / maxLength).toFixed(2);
}

app.post("/auth/register", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
    }

    const users = readUsers();
    if (users.find(user => user.username === username)) {
        return res.status(400).json({ message: "Username already exists" });
    }

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        users.push({ username, password: hashedPassword , isAdmin:0,credits:20,creditsUsed:0});
        writeUsers(users);
        return res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        return res.status(500).json({ message: "Error registering user" });
    }
});

app.post("/auth/login", async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ message: "Username and password are required" });
    }

    const users = readUsers();
    const user = users.find(u => u.username === username);

    if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
    }

    req.session.userId = username;
    return res.json({ username });
});

app.post("/auth/logout", (req, res) => {
    req.session.destroy(err => {
        if (err) {
            return res.status(500).json({ message: "Error logging out" });
        }
        return res.json({ message: "Logout successful" });
    });
});

app.get("/protected-route", (req, res) => {
    console.log("Session data:", req.session); // Debugging

    if (!req.session.userId) {
        return res.status(403).json({ message: "User not logged in" });
    }

    res.json({ message: "Protected content accessed", user: req.session.userId });
});

app.get("/user/profile",(req,res) => {
    if(!req.session.userId){
        return res.status(400).json({message:"User not logged in"})
    }
    const username = req.session.userId
    const users = readUsers();
    const user = users.find(u => u.username === username);
    return res.status(201).json({user:username,credits:user.credits})
})

app.post("/scanUpload",(req,res) => {
    if(!req.session || !req.session.userId){
        return res.status(400).json({message:"User not logged in"})
    }
    const username = req.session.userId
    const users = readUsers();
    const user = users.find(u => u.username === username);
    const file_name = `${req.headers['file-name']}.txt`
    const upload_directory = path.join("./documents",file_name)
    if(user.credits === 0){
        return res.status(201).json({message:"No credits left, you can ask admin for more credits"})
    }
    fs.writeFile(upload_directory, req.body, (error) => {
        if(error){
            return res.status(400).json({message:"file upload failed"})
        }
        user.credits--
        user.creditsUsed++
        updateUser(username,user)
        return res.status(201).json({message:"file successfully uploaded"})
    })
})

app.get("/matches/:docIdGet",(req,res) => {
    if(!req.session.userId){
        return res.status(400).json({message:"User not logged in"})
    }
    const doc_id = req.params.docIdGet
    const file_to_get_similarity = path.join("./documents",doc_id+".txt")
    const contentToCompare = fs.readFileSync(file_to_get_similarity,"utf-8")
    let similarities = Array()
    fs.readdirSync("./documents").forEach(file => {
        if(path.extname(file) === ".txt"){
            const file_path = path.join("./documents",file)
            const file_content = fs.readFileSync(file_path,"utf-8")
            let similarityDocs =(similarity(contentToCompare,file_content) )* 100
            similarities.push({file:file,similarity:similarityDocs})
        }
    })
    return res.status(201).json(similarities)
})

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});


//set header file-name while uploading file
// implement matching logic
//implement admin logic
