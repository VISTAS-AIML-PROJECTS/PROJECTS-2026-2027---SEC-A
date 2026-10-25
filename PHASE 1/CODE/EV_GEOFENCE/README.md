# Smart EV Security System Using GPS, GSM and Geofencing

A low-cost embedded security prototype for monitoring an electric vehicle's location and detecting possible unauthorized movement. The project report describes an ESP32-based system that establishes a home location, checks GPS movement against a geofence, monitors additional sensors, and gives a local buzzer alert when the vehicle moves outside the permitted area.

## Project goals

- Monitor the vehicle's geographic location.
- Save the current position as the authorized home location.
- Detect movement or presence around the vehicle.
- Compare the live GPS position with the saved location to determine whether it has left the geofence.
- Show location and security information on an OLED display.
- Give an immediate audible warning when a geofence violation is detected.

## Hardware described in the report

| Component | Purpose |
| --- | --- |
| ESP32 | Main controller; reads sensors and runs the geofence check |
| NEO-6M GPS module | Provides the current geographic position |
| Push button | Captures and stores the home/reference position |
| PIR sensor | Detects motion or presence near the vehicle |
| GY-271 / QMC5883L magnetometer | Monitors magnetic-field or orientation changes associated with movement |
| SSD1306 OLED | Displays GPS and security status locally |
| Buzzer | Sounds when the vehicle is detected outside the permitted area |

## How it works

1. The ESP32 initializes the connected sensors and OLED.
2. The user presses the button to save the current GPS position as the home location.
3. The GPS module supplies the current position while the PIR and magnetometer provide additional movement-related inputs.
4. The ESP32 compares the current position with the saved location and evaluates the geofence condition.
5. The OLED displays system information. If the vehicle crosses the permitted boundary, the buzzer turns on.

## System behavior

- **Normal condition:** The vehicle remains within the permitted area; the report describes no geofence buzzer alert.
- **Geofence violation:** The vehicle moves beyond the permitted area; the system activates the buzzer.

GPS performance depends on satellite reception and may be reduced indoors or in areas with poor visibility of the sky.

## GSM and features listed as future scope

The report title and abstract refer to GSM alerts and remote immobilization. However, the detailed working methodology and result sections describe local OLED and buzzer alerts. They list GSM SMS alerts, mobile or web live tracking, remote vehicle immobilization, cloud monitoring, and AI/ML-based detection as future enhancements. Confirm which of these are implemented in the submitted hardware/software before presenting them as working features.

## Repository contents

The GitHub repository is organized as an Android Gradle project with an `app/` module and Kotlin Gradle configuration files. The project report describes the embedded ESP32 security prototype above. Update this section if the repository also contains the ESP32 firmware or a companion mobile app implementation.

## Build and run

Open the repository in Android Studio and allow Gradle sync to finish. Connect an Android device or start an emulator, then use **Run** to build and launch the `app` module.

This Android build instruction describes the repository structure; the report does not specify Android app functionality or document firmware build steps, board wiring, or source-code dependencies.

## Future enhancements

- GSM-based SMS alerts containing the GPS location
- Mobile or web-based live tracking
- Authenticated remote vehicle immobilization
- Cloud telemetry and monitoring
- AI/ML-based theft or abnormal-movement detection
- Improved geofence configuration and accuracy

## Project information

- **Project title:** Smart EV Security System Using GPS, GSM and Geofencing
- **Controller:** ESP32
- **Application area:** EV security, movement detection, and geofence monitoring

