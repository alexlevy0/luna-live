import cors from "cors"
import dotenv from "dotenv"
import voice from "elevenlabs-node"
import { ElevenLabsClient, play } from "elevenlabs"
import express from "express"
import { exec } from "node:child_process"
import { promises as fs } from "node:fs"
import OpenAI from "openai"
import { WebcastPushConnection } from "tiktok-live-connector"
import say from "say"
import { WebSocketServer } from "ws"
import http from "node:http"

const elevenlabs = new ElevenLabsClient({
	// apiKey: "sk_367375957f9f9a888c2c3869b93778dc22b88098bb4872e3", // Defaults to process.env.ELEVENLABS_API_KEY
	apiKey: "sk_ee1070b044ecddfb65806610afc47e42a5af9f2082d01fd2", // Defaults to process.env.ELEVENLABS_API_KEY
})

dotenv.config()

const openai = new OpenAI({
	// apiKey: process.env.OPENAI_API_KEY || "-", // Your OpenAI API key here, I used "-" to avoid errors when the key is not set but you should not do that
	apiKey: "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",
})

// const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY
const elevenLabsApiKey = "sk_367375957f9f9a888c2c3869b93778dc22b88098bb4872e3"
// const voiceID = "kgG7dCoKCfLehAPWkJOE"
const voiceID = "C7VHv0h3cGzIczU4biXw" // FR

const app = express()
app.use(express.json())
app.use(cors())
const port = 3000

const config = {
	useSay: true,
	defaultVoice: "Amélie",
	speed: 1.05,
}

let tiktokLiveLastMessage = ""

// Create HTTP server
const server = http.createServer(app)
const wss = new WebSocketServer({ server })

// Store connected clients
const clients = new Set()

// WebSocket connection handler
wss.on("connection", (ws) => {
	clients.add(ws)
	console.log("New client connected")

	ws.on("close", () => {
		clients.delete(ws)
		console.log("Client disconnected")
	})
})

const initTiktokLiveListener = async (tiktokLiveAccount) => {
	try {
		const tiktokLiveConnection = new WebcastPushConnection(tiktokLiveAccount)
		const state = await tiktokLiveConnection.connect()

		console.info(`Connected to roomId ${state.roomId}`)
		console.info(`Connected to tiktokLiveAccount ${tiktokLiveAccount}`)

		tiktokLiveConnection.on("chat", (data) => {
			// console.log(`${data.uniqueId} (userId:${data.userId}) writes: ${data.comment}`)
			if (tiktokLiveLastMessage) {
				console.log(`chat skip ---:${tiktokLiveLastMessage}`)
				return
			}
			tiktokLiveLastMessage = data.comment
			console.log(`chat:${data.comment}`)

			// Broadcast to all connected clients
			const response = { messages, originalMessage: data.comment }
			for (const client of clients) {
				if (client.readyState === 1) {
					// Check if client is still connected
					client.send(JSON.stringify(response))
				}
			}
		})
	} catch (error) {
		console.error(error)
	}
}
// initTiktokLiveListener()
const speakWithSay = (text) => {
	return new Promise((resolve, reject) => {
		say.speak(text, config.defaultVoice, config.speed, (err) => {
			if (err) {
				console.error("Erreur say:", err)
			} else {
				resolve()
			}
		})
	})
}

// Fonction pour la synthèse vocale avec ElevenLabs
const speakWithElevenLabs = async (text) => {
	const audio = await elevenlabs.generate({
		voice: "Rachel",
		text,
		model_id: "eleven_multilingual_v2",
	})
	await play(audio)
}

app.post("/chat", async (req, res) => {
	const userMessage = req.body.message

	if (userMessage?.match(/^init/)) {
		console.log("------init-----")
		const tiktokLiveAccount = userMessage.replace("init:", "")
		initTiktokLiveListener(tiktokLiveAccount)
		res.send({
			messages: [
				{
					text: "Hey dear... How was your day?",
					facialExpression: "smile",
					animation: "Talking_1",
				},
				{
					text: "I missed you so much... Please don't go for so long!",
					facialExpression: "smile",
					animation: "Rumba",
				},
			],
		})
		return
	}

	if (!req.originalUrl?.match(/getChat/)) {
		const messages = await askGPT(userMessage)
		res.send({ messages })
		return
	}

	if (!tiktokLiveLastMessage) {
		res.send({ messages: [] })
		return
	}

	const messages = await askGPT(tiktokLiveLastMessage)
	console.log({ messages })
	res.send({ messages })
	tiktokLiveLastMessage = ""
})

const askGPT = async (message) => {
	try {
		const text = await getText(message, { useLocal: true })
		console.log(`resp:${text}`)

		if (config.useSay) {
			await speakWithSay(text)
		} else {
			await speakWithElevenLabs(text)
		}
		return text
	} catch (error) {
		console.error(error)
	}
}

const getText = async (message, { useLocal = false }) => {
	if (useLocal) {
		// console.log pour afficher l'heure
		const date = new Date()
		console.log(`1--[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] ${message}`)
		const res = await fetch(`http://localhost:11434/api/chat`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				model: "llama3.1",
				messages: [
					{
						// role: "system",
						// content: `
						// 	You are a virtual girlfriend.
						// 	You will always reply with a JSON array of messages. With a maximum of 3 messages.
						// 	Each message has a text, facialExpression, and animation property.
						// 	The different facial expressions are: smile, sad, angry, surprised, funnyFace, and default.
						// 	The different animations are: Talking_0, Talking_1, Talking_2, Crying, Laughing, Rumba, Idle, Terrified, and Angry.
						// `,
						role: "system",
						content: `
							Répond 10 mots maximum et dans la meme langue que celle de la question et reprends les mots de la question.
						`,
					},
					{ role: "user", content: message },
				],
				stream: false,
			}),
		})
		console.log(`2--[${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}] ${message}`)

		const {
			message: { content },
		} = await res.json()
		console.log({ content })
		return content
	}

	const completion = await openai.chat.completions.create({
		model: "gpt-3.5-turbo-1106",
		max_tokens: 1000,
		temperature: 0.6,
		response_format: {
			type: "json_object",
		},
		messages: [
			{
				role: "system",
				content: `
					You are a virtual girlfriend.
					You will always reply with a JSON array of messages. With a maximum of 3 messages.
					Each message has a text, facialExpression, and animation property.
					The different facial expressions are: smile, sad, angry, surprised, funnyFace, and default.
					The different animations are: Talking_0, Talking_1, Talking_2, Crying, Laughing, Rumba, Idle, Terrified, and Angry. 
				`,
			},
			{
				role: "user",
				// content: tiktokLiveMessages[tiktokLiveMessages.length - 1] || "Hello",
				content: message || "Hello",
			},
		],
	})
	let messages = JSON.parse(completion.choices[0].message.content)
	if (messages.messages) {
		messages = messages.messages // ChatGPT is not 100% reliable, sometimes it directly returns an array and sometimes a JSON object with a messages property
	}
	const text = messages[messages.length - 1].text
	return text
}

server.listen(port, () => {
	console.log(`Virtual Girlfriend listening on port ${port}`)
	console.log(`TTS Mode: ${config.useSay ? "say" : "ElevenLabs"}`)
})
