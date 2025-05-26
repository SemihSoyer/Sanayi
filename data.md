

business_availability
• id (uuid)
• business_id (uuid) --> public.businesses.id (foreign keys)
• date (date)
• is_open (bool)
• max_appointments_per_day (int4) sabit 5
• current_appointments_count (int4)
• notes (text) 
• created_at (timestamptz)
• updated_at (timestamptz)

appointments
• id (uuid)
• business_id (uuid) --> public.businesses.id (foreign keys)
• customer_id (uuid) --> public.profiles.id (foreign keys)
• appointment_date (date)
• appointment_time (time)
• car_photo_url (text)
• status (varchar)
• customer_notes (text)
• business_notes (text)
• created_at (timestamptz)
• updated_at (timestamptz)
• notes (text)

appointment_time_slots
• id (uuid)
• business_id (uuid) --> public.businesses.id (foreign keys)
• slot_name (varchar)
• start_time (time)
• end_time (time)
• duration_minutes (int4)
• is_active (bool)
• max_concurrent_appointments (int4)
• buffer_time_minutes (int4)
• days_of_week (int4)
• effective_from (date)
• effective_until (date)
• created_at (timestamptz)
• updated_at (timestamptz)

appointment_log
• id (uuid)
• appointment_id (uuid) --> public.appointments.id (foreign keys)
• old_status (varchar)
• new_status (varchar)
• changed_by (uuid) --> public.profiles.id (foreign keys)
• changed_at (timestamptz)
• notes (text)

businesses
• id (uuid)
• name (text)
• description (text)
• address (text)
• photos (jsonb)
• created_at (timestamptz)
• owner_id (uuid) --> public.profiles.id (foreign keys)
• updated_at (timestamptz)
• is_published (bool)
• latitude (float8)
• longitude (float8)
• city_id (uuid) --> public.cities.id

cities 
• id (uuid)
• name (text)
• created_at (timestamptz)

profiles 
• id (uuid) --> auth.users.id (foreign keys)
• updated_at (timestamptz)
• usernam (text)
• full_name (text)
• avatar_url (text)
• website (text)
• role (text) customer veya business_owner

businessclicks 
• id (uuid)
• business_id (uuid) --> public.businesses.id (foreign keys)
• clicked_at (timestamptz)
• user_id (uuid) --> auth.users.id (foreign keys)

ServiceTypes
• id (uuid)
• name (text)
• description (text)
• icon_url (text)
• created_At (timestamptz)

BusinessServices
• id (uuid)
• business_id (uuid) --> public.businesses.id (foreign keys)
• service_type_id (uuid) --> public.ServiceTypes.id (foreign keys)
• created_at (timestamptz)

daily_slot_availability
• id (uuid)
• business_id (uuid) --> public.businesses.id (foreign keys)
• slot_id (uuid) --> public.appointment_time_slots.id (foreign keys)
• date (date)
• is_available (bool)
• max_appointments_in_slot (int4)
• current_appointments_in_slot (int4)
• created_at (timestamptz)
• updated_at (timestamptz)

business_operating_hours
• id (uuid)
• business_id (uuid) --> public.businesses.id (foreign keys)
• day_of_week (int2)
• open_time (time)
• close_time (time)
• is_closed (bool) 
• created_at (timestamptz)
• updated_at (timestamptz)
 