export type Role = "admin" | "driver";

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  phone: string | null;
  email: string | null;
  truck_number: string | null;
  hourly_pay: number | null;
  cdl_number: string | null;
  license_expiration: string | null;
  medical_card_expiration: string | null;
  active: boolean;
  created_at: string;
}

export interface Load {
  id: string;
  sheet_id: string;
  job_site: string | null;
  dumping: string | null;
  type: string | null;
  company: string | null;
  job_site_arrival_time: string | null;
  job_site_departure_time: string | null;
}

export interface ProductionSheet {
  id: string;
  driver_id: string;
  date: string;
  truck_number: string | null;
  start_time: string | null;
  end_time: string | null;
  hours: number | null;
  fuel_gallons: number | null;
  start_miles: number | null;
  end_miles: number | null;
  total_miles: number | null;
  mpg: number | null;
  labor_cost: number | null;
  remarks: string | null;
  submitted_at: string;
  deleted_at?: string | null;
  loads?: Load[];
  profiles?: Pick<Profile, "full_name" | "truck_number">;
}
