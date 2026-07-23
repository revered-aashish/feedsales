import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { regionStore } from '../regionStore';
import { useAuth } from './AuthContext';
import api from '../api';

const RegionContext = createContext(null);

export function RegionProvider({ children }) {
  const { user } = useAuth();
  const [activeRegion, setActiveRegionState] = useState(null);
  const [regions, setRegions] = useState([]);

  const setActiveRegion = (r) => {
    regionStore.set(r);
    setActiveRegionState(r);
  };

  const refreshRegions = useCallback(async () => {
    try {
      const { data } = await api.get('/regions');
      setRegions(data);
    } catch { /* ignore */ }
  }, []);

  // Load regions once a user is logged in; clear on logout
  useEffect(() => {
    if (user) {
      refreshRegions();
    } else {
      setRegions([]);
      setActiveRegion(null);
    }
  }, [user, refreshRegions]);

  return (
    <RegionContext.Provider value={{ activeRegion, setActiveRegion, regions, refreshRegions }}>
      {children}
    </RegionContext.Provider>
  );
}

export const useRegion = () => useContext(RegionContext);
