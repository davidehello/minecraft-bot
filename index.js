const mineflayer = require('mineflayer');
const express = require('express');

// Web server for Render
const app = express();
const PORT = process.env.PORT || 10000;

// Your server config
const config = {
    ip: "chupadoresdepika.aternos.me",
    port: 14595,
    name: "BOT",
    loginmsg: "Bot ativo, aternos 24/7 ativado!"
};

let bot = null;
let botConnected = false;
let afkInterval = null;
let lastActivity = Date.now();

// Simple web server
app.get('/', (req, res) => {
    res.send(`
        <h1>Bot Status: ${botConnected ? 'ONLINE' : 'OFFLINE'}</h1>
        <p>Last activity: ${Math.floor((Date.now() - lastActivity) / 1000)} seconds ago</p>
    `);
});

app.get('/ping', (req, res) => {
    res.json({ alive: true });
});

app.listen(PORT, () => {
    console.log(`Web server on port ${PORT}`);
});

function createBot() {
    console.log(`[${new Date().toISOString()}] Creating bot...`);

    bot = mineflayer.createBot({
        host: config.ip,
        port: config.port,
        username: config.name,
        version: false,
        auth: 'offline',
        keepAlive: true,
        keepAliveInterval: 5000, // Send keep-alive every 5 seconds!
        checkTimeoutInterval: 300000 // 5 minute timeout
    });

    bot.once('spawn', () => {
        console.log(`[${new Date().toISOString()}] ✅ Bot spawned!`);
        botConnected = true;
        lastActivity = Date.now();

        // Send login message
        setTimeout(() => {
            bot.chat(config.loginmsg);
        }, 3000);

        // START AGGRESSIVE ANTI-AFK
        startAntiAFK();
    });

    bot.on('death', () => {
        console.log(`[${new Date().toISOString()}] Died - respawning in 5s`);
        setTimeout(() => {
            if (bot) bot.respawn();
        }, 5000);
    });

    bot.on('kicked', (reason) => {
        console.log(`[${new Date().toISOString()}] KICKED: ${JSON.stringify(reason)}`);
        botConnected = false;
        stopAntiAFK();
    });

    bot.on('end', (reason) => {
        console.log(`[${new Date().toISOString()}] Disconnected: ${reason}`);
        botConnected = false;
        stopAntiAFK();

        // Reconnect after 30 seconds
        setTimeout(createBot, 30000);
    });

    bot.on('error', (err) => {
        console.log(`[${new Date().toISOString()}] Error: ${err.message}`);
    });

    // Prevent sleeping
    bot.on('sleep', () => {
        bot.wake();
    });
}

function startAntiAFK() {
    console.log(`[${new Date().toISOString()}] Starting AGGRESSIVE Anti-AFK`);

    // Clear any existing interval
    stopAntiAFK();

    // CRITICAL: Move every 20 seconds to prevent AFK kick!
    afkInterval = setInterval(() => {
        if (!bot || !botConnected) {
            stopAntiAFK();
            return;
        }

        try {
            // Log activity
            const timeSinceLastActivity = Date.now() - lastActivity;
            console.log(`[${new Date().toISOString()}] Anti-AFK: ${timeSinceLastActivity}ms since last activity`);

            // ALWAYS do multiple actions to ensure server sees activity

            // 1. Look around
            const yaw = Math.random() * Math.PI * 2;
            const pitch = (Math.random() - 0.5) * Math.PI / 2;
            bot.look(yaw, pitch, true);

            // 2. Swing arm
            bot.swingArm();

            // 3. Jump
            bot.setControlState('jump', true);
            setTimeout(() => bot.setControlState('jump', false), 100);

            // 4. Move forward/back alternating
            const moveDirection = Math.random() > 0.5 ? 'forward' : 'back';
            bot.setControlState(moveDirection, true);
            setTimeout(() => {
                bot.setControlState(moveDirection, false);

                // 5. Sneak toggle
                bot.setControlState('sneak', true);
                setTimeout(() => bot.setControlState('sneak', false), 500);
            }, 500);

            // 6. Send chat message occasionally (every 5 minutes)
            if (timeSinceLastActivity > 300000) {
                bot.chat(`/ping`); // Many servers have /ping command
                console.log(`[${new Date().toISOString()}] Sent /ping to stay active`);
            }

            // Update last activity
            lastActivity = Date.now();

            console.log(`[${new Date().toISOString()}] ✓ Anti-AFK actions completed`);

        } catch (err) {
            console.log(`[${new Date().toISOString()}] Anti-AFK error: ${err.message}`);
        }

    }, 20000); // Every 20 seconds! Much more frequent than before

    // Additional movement every 45 seconds for variety
    setInterval(() => {
        if (!bot || !botConnected) return;

        try {
            // Strafe left/right
            const strafe = Math.random() > 0.5 ? 'left' : 'right';
            bot.setControlState(strafe, true);
            setTimeout(() => bot.setControlState(strafe, false), 300);

            // Sprint briefly
            bot.setControlState('sprint', true);
            bot.setControlState('forward', true);
            setTimeout(() => {
                bot.setControlState('sprint', false);
                bot.setControlState('forward', false);
            }, 1000);

            console.log(`[${new Date().toISOString()}] Extra movement completed`);
        } catch (err) {
            // Ignore
        }
    }, 45000);

    // Log status every 2 minutes
    setInterval(() => {
        if (bot && botConnected && bot.entity) {
            console.log(`[${new Date().toISOString()}] STATUS CHECK:`);
            console.log(`  Health: ${bot.health}/20`);
            console.log(`  Food: ${bot.food}/20`);
            console.log(`  Position: ${bot.entity.position}`);
            console.log(`  Time since last activity: ${Math.floor((Date.now() - lastActivity) / 1000)}s`);
        }
    }, 120000);
}

function stopAntiAFK() {
    if (afkInterval) {
        clearInterval(afkInterval);
        afkInterval = null;
    }
}

// Reconnect loop
setInterval(() => {
    if (!botConnected) {
        console.log(`[${new Date().toISOString()}] Bot offline - reconnecting...`);
        createBot();
    } else if (bot && bot.entity) {
        // Check if bot is actually responsive
        try {
            const pos = bot.entity.position;
            // Try to move slightly to test responsiveness
            bot.look(bot.entity.yaw + 0.1, bot.entity.pitch);
        } catch (err) {
            console.log(`[${new Date().toISOString()}] Bot unresponsive - reconnecting`);
            botConnected = false;
            if (bot) bot.end();
        }
    }
}, 60000);

// Handle errors globally
process.on('uncaughtException', (err) => {
    console.error(`Uncaught: ${err.message}`);
});

process.on('unhandledRejection', (err) => {
    console.error(`Unhandled: ${err}`);
});

// Start bot
console.log('=================================');
console.log('ANTI-TIMEOUT BOT v5.0');
console.log('Focus: Prevent AFK timeouts');
console.log('=================================');

setTimeout(createBot, 3000);