import { createContext, useContext, useEffect, useState } from "react"

const backendUrl = "http://localhost:3000"

const ChatContext = createContext()

export const ChatProvider = ({ children }) => {
	const chat = async (message) => {
		setLoading(true)
		const data = await fetch(`${backendUrl}/chat`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ message }),
		})
		const resp = (await data.json()).messages
		console.log({ messages })
		console.log({ resp })
		setMessages((messages) => [...messages, resp])
		setLoading(false)
	}
	const chatPool = async () => {
		setLoading(true)
		const data = await fetch(`${backendUrl}/chat?getChat=true`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
		})
		const resp = (await data.json()).messages
		// console.log({ messages })
		// console.log({ resp })
		setMessages((messages) => [...messages, resp])
		setLoading(false)
	}
	const [messages, setMessages] = useState([])
	const [message, setMessage] = useState()
	const [loading, setLoading] = useState(false)
	const [cameraZoomed, setCameraZoomed] = useState(true)

	const onMessagePlayed = () => {
		setMessages((messages) => messages.slice(1))
	}

	useEffect(() => {
		console.log("-messages:", messages)
		if (messages.length > 0) {
			// console.log('-messages:', messages)
			setMessage(messages[0])
		} else {
			setMessage(null)
		}
	}, [messages])

	return (
		<ChatContext.Provider
			value={{
				chat,
				chatPool,
				message,
				onMessagePlayed,
				loading,
				cameraZoomed,
				setCameraZoomed,
			}}
		>
			{children}
		</ChatContext.Provider>
	)
}

export const useChat = () => {
	const context = useContext(ChatContext)
	if (!context) {
		throw new Error("useChat must be used within a ChatProvider")
	}
	return context
}
