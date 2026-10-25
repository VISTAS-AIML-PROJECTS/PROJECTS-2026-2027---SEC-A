package com.example.evgeofencegps

import android.Manifest
import android.annotation.SuppressLint
import android.content.pm.PackageManager
import android.location.Location
import android.os.Bundle
import android.widget.Button
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.ActivityCompat
import com.google.android.gms.location.*

class MainActivity : AppCompatActivity() {

    private lateinit var fused: FusedLocationProviderClient
    private lateinit var locationRequest: LocationRequest
    private var callback: LocationCallback? = null

    private lateinit var statusText: TextView
    private lateinit var espText: TextView
    private lateinit var latText: TextView
    private lateinit var lonText: TextView
    private lateinit var accuracyText: TextView
    private lateinit var distanceText: TextView
    private lateinit var startButton: Button
    private lateinit var homeButton: Button
    private lateinit var stopButton: Button

    private var homeLat: Double? = null
    private var homeLon: Double? = null
    private var lastLocation: Location? = null

    companion object {
        private const val REQUEST_LOCATION = 100
        private const val GEOFENCE_RADIUS = 5.0
        private const val ESP32_URL = "http://192.168.4.1/gps"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        fused = LocationServices.getFusedLocationProviderClient(this)

        statusText = findViewById(R.id.statusText)
        espText = findViewById(R.id.espText)
        latText = findViewById(R.id.latText)
        lonText = findViewById(R.id.lonText)
        accuracyText = findViewById(R.id.accuracyText)
        distanceText = findViewById(R.id.distanceText)
        startButton = findViewById(R.id.startButton)
        homeButton = findViewById(R.id.homeButton)
        stopButton = findViewById(R.id.stopButton)

        locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY, 1000L
        ).setMinUpdateIntervalMillis(500L)
         .setWaitForAccurateLocation(false)
         .build()

        startButton.setOnClickListener { startGps() }
        homeButton.setOnClickListener { setHome() }
        stopButton.setOnClickListener { stopGps() }
    }

    private fun hasLocationPermission(): Boolean {
        return ActivityCompat.checkSelfPermission(
            this, Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }

    private fun startGps() {
        if (!hasLocationPermission()) {
            ActivityCompat.requestPermissions(
                this,
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                ),
                REQUEST_LOCATION
            )
            return
        }

        requestUpdates()
    }

    @SuppressLint("MissingPermission")
    private fun requestUpdates() {
        statusText.text = "🟡 GETTING PRECISE GPS..."

        callback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                val location = result.lastLocation ?: return
                lastLocation = location
                updateUi(location)
                sendToEsp32(location)
            }
        }

        fused.requestLocationUpdates(
            locationRequest,
            callback!!,
            mainLooper
        )

        startButton.isEnabled = false
        homeButton.isEnabled = true
        stopButton.isEnabled = true
    }

    private fun updateUi(location: Location) {
        latText.text = "Latitude: %.7f".format(location.latitude)
        lonText.text = "Longitude: %.7f".format(location.longitude)
        accuracyText.text = "Accuracy: %.1f m".format(location.accuracy)

        val hLat = homeLat
        val hLon = homeLon

        if (hLat == null || hLon == null) {
            distanceText.text = "Distance from Home: --"
            statusText.text = "🟡 GPS ACTIVE — SET HOME"
            return
        }

        val results = FloatArray(1)
        Location.distanceBetween(
            hLat, hLon,
            location.latitude, location.longitude,
            results
        )

        val distance = results[0]
        distanceText.text = "Distance from Home: %.1f m".format(distance)

        if (distance > GEOFENCE_RADIUS) {
            statusText.text = "🔴 GEOFENCE ALERT"
        } else {
            statusText.text = "🟢 SAFE — INSIDE 5 m"
        }
    }

    private fun setHome() {
        val location = lastLocation ?: return
        homeLat = location.latitude
        homeLon = location.longitude
        updateUi(location)
    }

    private fun stopGps() {
        callback?.let { fused.removeLocationUpdates(it) }
        callback = null

        startButton.isEnabled = true
        homeButton.isEnabled = false
        stopButton.isEnabled = false
        statusText.text = "GPS STOPPED"
    }

    private fun sendToEsp32(location: Location) {
        val url = ESP32_URL +
                "?lat=${location.latitude}" +
                "&lon=${location.longitude}" +
                "&acc=${location.accuracy}"

        Thread {
            try {
                val connection = java.net.URL(url).openConnection()
                        as java.net.HttpURLConnection
                connection.requestMethod = "GET"
                connection.connectTimeout = 1500
                connection.readTimeout = 1500
                connection.useCaches = false

                val code = connection.responseCode
                connection.disconnect()

                runOnUiThread {
                    if (code in 200..299) {
                        espText.text = "ESP32: ✅ GPS SENT"
                    } else {
                        espText.text = "ESP32: ⚠ HTTP $code"
                    }
                }
            } catch (e: Exception) {
                runOnUiThread {
                    espText.text = "ESP32: ❌ NOT REACHABLE"
                }
            }
        }.start()
    }

    override fun onRequestPermissionsResult(
        requestCode: Int,
        permissions: Array<out String>,
        grantResults: IntArray
    ) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)

        if (requestCode == REQUEST_LOCATION &&
            grantResults.isNotEmpty() &&
            grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            requestUpdates()
        } else {
            statusText.text = "🔴 LOCATION PERMISSION DENIED"
        }
    }

    override fun onDestroy() {
        stopGps()
        super.onDestroy()
    }
}
