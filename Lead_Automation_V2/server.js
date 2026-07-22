require("dotenv").config();

const express = require("express");
const axios = require("axios");

const app = express();

app.use(express.json());

app.get("/instagram/profile", async (req, res) => {

    try {

        const response = await axios.get(
            `https://graph.facebook.com/v23.0/${process.env.INSTAGRAM_BUSINESS_ID}`,
            {
                params: {
                    fields: "id,username,followers_count,follows_count,media_count",
                    access_token: process.env.META_ACCESS_TOKEN
                }
            }
        );

        res.json(response.data);

    } catch (err) {

        console.log(err.response?.data);

        res.status(500).json(err.response?.data || err.message);

    }

});

app.listen(process.env.PORT, () => {
    console.log(`Server running on ${process.env.PORT}`);
});
