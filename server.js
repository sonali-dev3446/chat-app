import express from 'express';
import { Server } from 'socket.io';
import cors from 'cors';
import http from 'http';
import { connect } from './config.js';
import ChatModel from "./chat.schema.js";

const app = express();
app.use(cors());

// create HTTP server
const server = http.createServer(app);

// create socket server
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ["GET", "POST"]
    }
});

// ✅ ACTIVE USERS
let activeUsers = [];

// SOCKET EVENTS
io.on('connection', (socket) => {

    console.log("User connected:", socket.id);

    // ✅ USER JOIN
    socket.on("join", async (username) => {

        socket.username = username;

        // add user to active list
        activeUsers.push(username);

        // remove duplicates
        activeUsers = [...new Set(activeUsers)];

        // send active users to everyone
        io.emit("active_users", activeUsers);

        // load old messages
        const messages = await ChatModel
            .find()
            .sort({ timestamp: 1 })
            .limit(50);

        socket.emit("load_messages", messages);
    });

    // ✅ NEW MESSAGE
    socket.on("new_message", async (data) => {

        // save to DB
        const saved = await ChatModel.create({
            username: socket.username,
            message: data.text
        });

        // broadcast to all users
        io.emit("broadcast_message", {
            text: saved.message,
            username: saved.username,
            senderId: socket.id
        });
    });

    // ✅ TYPING
    socket.on("typing", () => {
        socket.broadcast.emit("typing", socket.username);
    });

    // ✅ DISCONNECT
    socket.on("disconnect", () => {

        console.log("Disconnected:", socket.username);

        activeUsers = activeUsers.filter(
            user => user !== socket.username
        );

        io.emit("active_users", activeUsers);
    });

});

server.listen(3000, () => {
    console.log("Server running on port 3000");
    connect();
});