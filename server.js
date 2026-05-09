// =========================
// IMPORTS
// =========================

import express from 'express';

import { Server } from 'socket.io';

import cors from 'cors';

import http from 'http';

import { connect } from './config.js';

import ChatModel from "./chat.schema.js";


// =========================
// EXPRESS APP
// =========================

const app = express();

app.use(cors());


// =========================
// SERVE FRONTEND FILES
// =========================

app.use(express.static("public"));


// =========================
// CREATE HTTP SERVER
// =========================

const server = http.createServer(app);


// =========================
// SOCKET.IO SERVER
// =========================

const io = new Server(server, {

    cors: {
        origin: '*',
        methods: ["GET", "POST"]
    }
});


// =========================
// ACTIVE USERS ARRAY
// =========================

let activeUsers = [];


// =========================
// SOCKET CONNECTION
// =========================

// =========================
// SOCKET CONNECTION
// =========================

io.on("connection", (socket) => {

    console.log(
        "User connected:",
        socket.id
    );

    // =========================
    // USER JOIN
    // =========================

    socket.on("join", (username) => {

        // validate username
        if (!username || username.trim() === "") {

            console.log("Invalid username");

            return;
        }

        socket.username = username.trim();


        // add active user
        activeUsers.push(socket.username);

        // remove duplicates
        activeUsers = [...new Set(activeUsers)];

        // send active users
        io.emit(
            "active_users",
            activeUsers
        );
    });

    // =========================
    // LOAD PRIVATE MESSAGES
    // =========================

    socket.on(
        "load_private_messages",

        async (data) => {

            try {

                const messages =
                    await ChatModel.find({

                        $or: [

                            {
                                sender: data.sender,
                                receiver: data.receiver
                            },

                            {
                                sender: data.receiver,
                                receiver: data.sender
                            }
                        ]

                    }).sort({
                        timestamp: 1
                    });

                socket.emit(
                    "private_messages",
                    messages
                );

            } catch (err) {

                console.log(
                    "Load message error:",
                    err.message
                );
            }
        }
    );

    // =========================
    // NEW MESSAGE
    // =========================

    socket.on(
        "new_message",

        async (data) => {

            try {


                // validation
                if (
                    !data.sender ||
                    !data.receiver ||
                    !data.text
                ) {

                    console.log(
                        "Invalid message data"
                    );

                    return;
                }

                // save in DB
                const saved =
                    await ChatModel.create({

                        sender: data.sender,

                        receiver: data.receiver,

                        message: data.text,

                        timestamp: new Date()
                    });

                // send to all clients
                io.emit(
                    "broadcast_message",
                    {
                        sender: saved.sender,

                        receiver: saved.receiver,

                        text: saved.message
                    }
                );

            } catch (err) {

                console.log(
                    "Message error:",
                    err.message
                );
            }
        }
    );

    // =========================
    // TYPING EVENT
    // =========================

    socket.on("typing", () => {

        socket.broadcast.emit(
            "typing",
            socket.username
        );
    });

    // =========================
    // DISCONNECT
    // =========================

    socket.on("disconnect", () => {

        console.log(
            socket.username,
            "disconnected"
        );

        activeUsers =
            activeUsers.filter(
                user =>
                    user !== socket.username
            );

        io.emit(
            "active_users",
            activeUsers
        );
    });
});
// =========================
// START SERVER
// =========================

server.listen(3000, async () => {

    console.log(
        "Server running on port 3000"
    );

    // connect MongoDB
    await connect();
});