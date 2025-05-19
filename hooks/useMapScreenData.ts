import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import * as Location from 'expo-location';

// MapScreen'den alınan arayüzler
export interface MapBusiness {
  id: string;
  owner_id: string;
  name: string;
  latitude: number;
  longitude: number;
  photos: string[] | null; // Önizleme için eklendi
  address: string | null;  // Önizleme için eklendi
  // RPC'den gelebilecek diğer alanlar (description vb.) buraya eklenebilir
}

export interface ServiceType {
  id: string;
  name: string;
  icon_url?: string;
}

export const useMapScreenData = () => {
  const [location, setLocation] = useState<Location.LocationObject | null>(null);
  const [allMapBusinesses, setAllMapBusinesses] = useState<MapBusiness[]>([]);
  const [filteredMapBusinesses, setFilteredMapBusinesses] = useState<MapBusiness[]>([]);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [selectedServiceTypeIds, setSelectedServiceTypeIds] = useState<string[]>([]);

  const [loadingLocation, setLoadingLocation] = useState(true);
  const [loadingData, setLoadingData] = useState(true); 
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [filterModalVisible, setFilterModalVisible] = useState(false);

  const applyMapFilters = useCallback(async (currentSelectedServiceTypeIds: string[], isInitialLoad = false) => {
    if (!isInitialLoad) {
      setFilterModalVisible(false);
    }
    setLoadingData(true);
    setErrorMsg(null);

    try {
      const rpcParams = { 
        p_service_type_ids: currentSelectedServiceTypeIds.length > 0 ? currentSelectedServiceTypeIds : null 
      };
      
      console.log("[useMapScreenData] Calling RPC 'get_businesses_by_service_types' with params:", rpcParams);
      const { data: rpcData, error: rpcError } = await supabase.rpc('get_businesses_by_service_types', rpcParams);

      if (rpcError) {
        console.error("[useMapScreenData] RPC Error:", rpcError);
        throw rpcError;
      }
      console.log("[useMapScreenData] RPC Data:", rpcData);
      // RPC'den dönen verinin MapBusiness arayüzüne uygun olduğunu varsayıyoruz.
      // Gerekirse burada bir dönüşüm yapılabilir.
      const businessesWithLocation = (rpcData || []).filter((b: any) => b.latitude != null && b.longitude != null) as MapBusiness[];
      
      if (isInitialLoad) {
        setAllMapBusinesses(businessesWithLocation);
      }
      setFilteredMapBusinesses(businessesWithLocation);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Bilinmeyen bir hata oluştu.';
      setErrorMsg(`Filtreleme sırasında bir hata oluştu: ${errorMessage}`);
      console.error("[useMapScreenData] ApplyFilters Error:", err);
      setFilteredMapBusinesses([]);
    } finally {
      setLoadingData(false);
    }
  }, []); 

  const fetchData = useCallback(async () => {
    setLoadingLocation(true);
    setLoadingData(true);
    setErrorMsg(null);

    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setErrorMsg('Konum izni reddedildi. Harita özelliği kullanılamıyor.');
        setLoadingLocation(false);
        setLoadingData(false);
        return;
      }
      let currentLocation = await Location.getCurrentPositionAsync({});
      setLocation(currentLocation);
      setLoadingLocation(false);

      const { data: serviceTypesData, error: serviceTypesError } = await supabase
        .from('ServiceTypes')
        .select('id, name, icon_url');
      if (serviceTypesError) throw serviceTypesError;
      setServiceTypes(serviceTypesData || []);

      await applyMapFilters(selectedServiceTypeIds, true); // İlk yükleme için mevcut filtrelerle çağır

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Bilinmeyen bir hata oluştu.';
      setErrorMsg(`Veriler yüklenirken bir hata oluştu: ${errorMessage}`);
      console.error("[useMapScreenData] FetchData Error:", err);
      setLocation(null);
      setAllMapBusinesses([]);
      setFilteredMapBusinesses([]);
      setServiceTypes([]);
    } finally {
      // setLoadingLocation ve setLoadingData zaten yukarıda yönetiliyor.
    }
  }, [applyMapFilters, selectedServiceTypeIds]);

  const clearMapFilters = useCallback(() => {
    const newSelectedServiceTypeIds: string[] = [];
    setSelectedServiceTypeIds(newSelectedServiceTypeIds);
    applyMapFilters(newSelectedServiceTypeIds, false); // Filtreleri temizleyip yeniden yükle
    setFilterModalVisible(false);
  }, [applyMapFilters]);

  const handleServiceTypeToggle = (serviceTypeId: string) => {
    setSelectedServiceTypeIds(prev => 
      prev.includes(serviceTypeId) 
        ? prev.filter(id => id !== serviceTypeId) 
        : [...prev, serviceTypeId]
    );
  };
  
  // applyMapFilters'ı dışarıya açarken, selectedServiceTypeIds'ı argüman olarak almasını sağladık.
  // Bu hook'u kullanan component, kendi state'inden bu ID'leri gönderecek.
  // Ancak, kolaylık olması açısından hook içindeki selectedServiceTypeIds'ı kullanan bir versiyonunu da sağlayabiliriz.
  const triggerApplyFilters = () => {
    applyMapFilters(selectedServiceTypeIds, false);
  };

  return {
    location,
    filteredMapBusinesses,
    serviceTypes,
    selectedServiceTypeIds,
    loadingLocation,
    loadingData,
    errorMsg,
    filterModalVisible,
    fetchData,
    setFilterModalVisible,
    handleServiceTypeToggle,
    setSelectedServiceTypeIds, // Dışarıdan da ayarlanabilmesi için
    triggerApplyFilters,       // Hook içindeki ID'lerle filtrelemeyi tetiklemek için
    clearMapFilters,
  };
}; 