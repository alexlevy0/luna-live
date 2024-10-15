import cors from "cors"
import dotenv from "dotenv"
import voice from "elevenlabs-node"
import { ElevenLabsClient, play } from "elevenlabs"
import express from "express"
import { exec } from "node:child_process"
import { promises as fs } from "node:fs"
import OpenAI from "openai"
import { WebcastPushConnection } from "tiktok-live-connector"

const elevenlabs = new ElevenLabsClient({
	apiKey: "sk_367375957f9f9a888c2c3869b93778dc22b88098bb4872e3", // Defaults to process.env.ELEVENLABS_API_KEY
})

dotenv.config()

let tiktokLiveLastMessage = ""

const initTiktokLiveListener = async (tiktokLiveAccount) => {
	try {
		const tiktokLiveConnection = new WebcastPushConnection(tiktokLiveAccount)
		const state = await tiktokLiveConnection.connect()

		console.info(`Connected to roomId ${state.roomId}`)
		console.info(`Connected to tiktokLiveAccount ${tiktokLiveAccount}`)

		tiktokLiveConnection.on("chat", (data) => {
			// console.log(`${data.uniqueId} (userId:${data.userId}) writes: ${data.comment}`)
			tiktokLiveLastMessage = data.comment
			console.log(`chat:${data.comment}`)
		})
	} catch (error) {
		console.error(error)
	}
}

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

app.post("/chat", async (req, res) => {
	const userMessage = req.body.message

	if (userMessage?.match(/^init/)) {
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
})

app.listen(port, () => {
	console.log(`Virtual Girlfriend listening on port ${port}`)
})

const askGPT = async (message) => {
	tiktokLiveLastMessage = ""
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
	console.log(`resp:${messages[0].text}`)
	const audio = await elevenlabs.generate({
		voice: "Rachel",
		text: messages[messages.length - 1].text,
		model_id: "eleven_multilingual_v2",
	})
	play(audio)
	return messages
}
