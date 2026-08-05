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

export interface Driver {
  id: string;
  full_name: string;
  phone: string | null;
  hourly_pay: number | null;
  cdl_number: string | null;
  license_expiration: string | null;
  medical_card_expiration: string | null;
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
  note: string | null;
}

export interface InvoiceTicket {
  id: string;
  ticket_no: string | null;
  date: string;
  client: string;
  location_project: string | null;
  truck_number: string | null;
  company_name: string;
  time_in: string | null;
  time_out: string | null;
  travel_time_hours: number | null;
  total_hours: number | null;
  loads: number | null;
  rate: number | null;
  invoice_id: string | null;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  company: string | null;
  address_line1: string | null;
  city_state_zip: string | null;
  phone: string | null;
  fax: string | null;
  email: string | null;
  default_rate: number | null;
  created_at: string;
}

export interface Invoice {
  id: string;
  invoice_no: string;
  date: string;
  client_id: string;
  customer: string | null;
  for_description: string | null;
  terms: string;
  total: number;
  created_at: string;
}

export interface ProductionSheet {
  id: string;
  driver_name: string;
  hourly_pay: number | null;
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
}
