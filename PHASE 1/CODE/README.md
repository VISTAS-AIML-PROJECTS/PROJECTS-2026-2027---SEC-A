# Smart Aquaculture Assistant – Code

## Description
This folder contains the source code, machine learning files, dataset, ESP32 code, and supporting files used for the Smart Aquaculture Assistant project.

## Main Components

### 1. Machine Learning
A Random Forest machine learning model is used for fish health status prediction using the project dataset.

### 2. ESP32
The ESP32 is used to collect sensor readings from the connected sensors.

### 3. Streamlit Dashboard
The Streamlit application provides a simple interface for monitoring sensor values and displaying fish health status.

## Sensors Used
- Temperature Sensor (DS18B20)
- Water Sensor (HW-038)
- TDS Sensor
- pH Sensor

## Software Used
- Python
- Jupyter Notebook
- Arduino IDE
- Streamlit

## Main Files


CODE
│
├── app.py
├── requirements.txt
├── Dataset/
├── ESP32/
└── Model/


## How to Run

Install the required Python packages:

```bash
pip install -r requirements.txt
```

Run the Streamlit application:

```bash
streamlit run app.py
```

## Note
The sensor readings and model outputs are used for prototype and demonstration purposes.
