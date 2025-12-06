require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");

const app = express();
const PORT = process.env.PORT || 3000;
const CWA_API_BASE_URL = "https://opendata.cwa.gov.tw/api";
const CWA_API_KEY = process.env.CWA_API_KEY;

app.use(cors());
app.use(express.json());

// 縣市名稱修正 Helper (CWA 使用 '臺' 而非 '台')
const fixCityName = (city) => {
  if (!city) return "臺北市"; // 預設值
  return city.replace(/台/g, "臺");
};

/**
 * 取得天氣預報 (支援動態縣市)
 * GET /api/weather?city=台中市
 */
const getWeather = async (req, res) => {
  try {
    if (!CWA_API_KEY) {
      return res.status(500).json({ error: "API Key Missing" });
    }

    // 1. 取得並修正縣市名稱
    const rawCity = req.query.city || "新北市";
    const targetCity = fixCityName(rawCity);

    // 2. 呼叫 CWA API
    const response = await axios.get(
      `${CWA_API_BASE_URL}/v1/rest/datastore/F-C0032-001`,
      {
        params: {
          Authorization: CWA_API_KEY,
          locationName: targetCity,
        },
      }
    );

    const locationData = response.data.records.location[0];

    if (!locationData) {
      return res.status(404).json({
        success: false,
        message: `找不到「${targetCity}」的資料，請確認縣市名稱是否正確。`,
      });
    }

    // 3. 資料整理 (保持你原本的邏輯，稍微精簡)
    const weatherData = {
      city: locationData.locationName,
      source: "CWA 中央氣象署",
      forecasts: [],
    };

    const weatherElements = locationData.weatherElement;
    // 取出時間長度 (通常是 3 個時段)
    const timePeriods = weatherElements[0].time;

    // 使用 map 遍歷時間段
    weatherData.forecasts = timePeriods.map((period, index) => {
      const forecast = {
        startTime: period.startTime,
        endTime: period.endTime,
      };

      // 填入各項數值
      weatherElements.forEach((el) => {
        const val = el.time[index].parameter;
        switch (el.elementName) {
          case "Wx": forecast.weather = val.parameterName; break;
          case "PoP": forecast.rainProb = val.parameterName + "%"; break; // 機率 Probability of Precipitation
          case "MinT": forecast.minTemp = val.parameterName + "°C"; break;
          case "MaxT": forecast.maxTemp = val.parameterName + "°C"; break;
          case "CI": forecast.comfort = val.parameterName; break;
          // 注意：F-C0032-001 資料集通常不包含 WS (風速)，若需要風速需使用其他 API
        }
      });
      return forecast;
    });

    res.json({ success: true, data: weatherData });

  } catch (error) {
    console.error("API Error:", error.message);
    res.status(500).json({ error: "無法取得氣象資料" });
  }
};

app.get("/api/weather", getWeather);

// Health Check
app.get("/health", (req, res) => res.send("OK"));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});