import { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";

const API = "http://localhost:8000";

const AqiContext = createContext(null);

export function AqiProvider({ children }) {
  const [data, setData] = useState(null);
  const [selectedCity, setSelectedCity] = useState("Delhi");
  const [error, setError] = useState("");

  const loadData = () => {
    setError("");
    setData(null);
    axios.get(`${API}/city-summary`)
      .then((response) => {
        setData(response.data);
        setSelectedCity((current) => (
          response.data.cities[current] ? current : Object.keys(response.data.cities)[0]
        ));
      })
      .catch(() => setError("Could not connect to API. Make sure the backend is running."));
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedData = data?.cities?.[selectedCity] ?? null;
  const value = useMemo(() => ({
    data,
    error,
    loadData,
    selectedCity,
    setSelectedCity,
    selectedData,
    currentAqi: selectedData?.aqi ?? null,
  }), [data, error, selectedCity, selectedData]);

  return <AqiContext.Provider value={value}>{children}</AqiContext.Provider>;
}

export function useAqi() {
  const context = useContext(AqiContext);
  if (!context) throw new Error("useAqi must be used within AqiProvider");
  return context;
}
