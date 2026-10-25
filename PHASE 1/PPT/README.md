# Smart Aquaculture Assistant – Project Presentation

## Project Title
**AI-Powered Fish Stress Prediction & Water Quality Management System**

## Project Overview
Smart Aquaculture Assistant is a low-cost IoT and machine-learning based project for monitoring water-related conditions and presenting easy-to-understand fish-health status.

The prototype uses an ESP32 with connected sensors and a Streamlit dashboard for live monitoring. A separate Random Forest experiment is trained using historical aquaculture data.

## Project Objectives
- Read live water-related measurements using ESP32 and connected sensors.
- Send sensor readings to a Python application.
- Display live readings through a Streamlit dashboard.
- Provide Normal, At Risk, and High Risk status indicators.
- Train and evaluate a Random Forest classifier using historical aquaculture data.
- Document the system workflow, limitations, and future improvements.

## Hardware Components
- ESP32 Development Board
- DS18B20 Temperature Sensor
- pH Sensor Interface
- TDS Sensor Module
- HW-038 Water Sensor

## Software Components
- Python
- Streamlit
- Arduino IDE
- Jupyter Notebook
- Random Forest Machine Learning

## Presentation Contents
The PPT covers:

1. Abstract
2. Problem Statement
3. Project Objectives
4. System Architecture
5. Hardware and Software Components
6. Hardware Prototype and Wiring
7. End-to-End Workflow
8. Machine-Learning Methodology
9. Live Fish-Health Status Logic
10. Streamlit Dashboard
11. Testing and Validation
12. Limitations
13. Future Enhancements
14. Conclusion

## Machine Learning
A Random Forest classifier with 100 estimators was trained using a historical aquaculture dataset containing **4,383 observations and 28 columns**.

The selected features are:
- Temperature
- Dissolved Oxygen
- pH
- Turbidity

The reported test-split accuracy is approximately **99.89%**. This result applies to the selected historical dataset split and should not be interpreted as live hardware accuracy.

## Live Monitoring
The current live prototype measures:
- Temperature
- pH
- TDS voltage
- Water-sensor values

The dashboard uses prototype rules to classify the current readings as:
- **Normal**
- **At Risk**
- **High Risk**

These are demonstration outputs and require proper sensor calibration and field validation before real-world use.

## Important Project Note
The historical Random Forest model and the current live sensor system are separate pipelines because their input features are different. The live prototype does not directly feed its current sensor values into the historical ML model.

## Limitations
- pH and TDS readings require additional calibration.
- The live prototype does not currently include dissolved oxygen and turbidity sensors.
- Sensor readings can be affected by placement and electrical conditions.
- The historical ML model and live sensor inputs are not yet integrated.
- Large-scale pond trials are not documented.

## Future Enhancements
- Calibrate pH and TDS sensors.
- Add dissolved oxygen and turbidity sensors.
- Collect synchronized real-world aquaculture data.
- Further validate the machine-learning model.
- Improve hardware deployment and connectivity.
- Conduct controlled field trials with aquaculture experts.

## Team
**Team Number:** 10

### Team Members
- Dharshish K.G
- Haamidsha D.
- Mohamed Sadhath J.

### Guide
**Mrs. F. Benasir Begam, M.E., (Ph.D.)**

### Institution
**Department of AI & ML, VISTAS, Chennai**
