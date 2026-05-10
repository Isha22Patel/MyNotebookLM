const { GoogleGenerativeAI } = require("@google/generative-ai");
require("dotenv").config();

async function listModels() {
    const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
    try {
        const result = await genAI.listModels();
        console.log("Available models:");
        result.models.forEach(model => {
            console.log(`${model.name} - ${model.supportedGenerationMethods}`);
        });
    } catch (error) {
        console.error("Error listing models:", error);
    }
}

listModels();
