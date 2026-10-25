#define LASER_PIN 4
#define RECEIVER_PIN 26
#define BUZZER_PIN 25

int previousSensorValue = 0;
int peopleCount = 0;

void setup() {
  Serial.begin(115200);
  Serial2.begin(115200, SERIAL_8N1, 16, 17);

  pinMode(LASER_PIN, OUTPUT);
  pinMode(RECEIVER_PIN, INPUT_PULLUP);
  pinMode(BUZZER_PIN, OUTPUT);

  digitalWrite(LASER_PIN, HIGH);
  noTone(BUZZER_PIN);

  previousSensorValue = digitalRead(RECEIVER_PIN);

  Serial.println("CROWDGUARD SYSTEM");
  Serial.println("People Count = 0");
}

void loop() {

  // ==========================================
  // RECEIVE ALERT FROM PYTHON
  // ==========================================

  if (Serial.available()) {

    String command = Serial.readStringUntil('\n');
    command.trim();

    if (command == "ALERT") {
      tone(BUZZER_PIN, 2000);
      Serial.println("!!! CROWD ALERT - BUZZER ON !!!");
    }

    else if (command == "NORMAL") {
      noTone(BUZZER_PIN);
      Serial.println("SYSTEM NORMAL - BUZZER OFF");
    }
  }

  // ==========================================
  // LASER BEAM DETECTION
  // ==========================================

  int sensorValue = digitalRead(RECEIVER_PIN);

  if (previousSensorValue == 0 && sensorValue == 1) {

    peopleCount++;

    Serial.print("PERSON DETECTED - Count = ");
    Serial.println(peopleCount);

    Serial.print("BEAM,");
    Serial.print(sensorValue);
    Serial.print(",");
    Serial.println(peopleCount);

    Serial2.print("BEAM,");
    Serial2.print(sensorValue);
    Serial2.print(",");
    Serial2.println(peopleCount);
  }

  previousSensorValue = sensorValue;

  delay(50);
}