// utils/emailService.js
import { ServerClient } from "postmark";
import { configDotenv } from "dotenv";

configDotenv();

const client = new ServerClient(process.env.POSTMARK_SERVER_API_TOKEN);

export const sendEmailsBatch = async (emails) => {
    try {
        const response = await client.sendEmailBatch(emails);
        console.log("✅ Batch emails sent successfully:", response.length);
    } catch (error) {
        console.error("❌ Error sending batch emails:", error);
    }
};

export const notifyPollstersBatch = async (pollsters, poll) => {
    const BATCH_SIZE = 100;

    for (let i = 0; i < pollsters.length; i += BATCH_SIZE) {
        const batch = pollsters.slice(i, i + BATCH_SIZE);

        const emails = batch.map((pollster) => {
            const voteLink = `${process.env.FRONTEND_URL}?token=${pollster.voteToken}`;
            return {
                From: process.env.POSTMARK_SENDER_EMAIL,
                To: pollster.email,
                Subject: `You're invited to vote in: ${poll.title}`,
                HtmlBody: `
          <h2>You're invited to vote in: <strong>${poll.title}</strong></h2>
          <p>Hello ${pollster.name || "there"},</p>
          <p>Please cast your vote by clicking the button below:</p>
          <a href="${voteLink}" style="display:inline-block;padding:10px 20px;background:#007BFF;color:white;text-decoration:none;border-radius:5px;">Vote Now</a>
          <p>If that doesn't work, you can also copy and paste this link:</p>
          <p><a href="${voteLink}">${voteLink}</a></p>
          <p>Thank you!</p>
        `,
            };
        });

        try {
            await sendEmailsBatch(emails);
            await new Promise((resolve) => setTimeout(resolve, 1000)); // throttle to respect Postmark rate limits
        } catch (error) {
            console.error(`❌ Failed to send pollster email batch ${i / BATCH_SIZE + 1}:`, error);
        }
    }
};
