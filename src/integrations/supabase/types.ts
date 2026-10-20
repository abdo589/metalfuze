export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      acct_sheets: {
        Row: {
          id: string
          name: string
          owner_id: string
          rows: Json
          sort: number
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          owner_id?: string
          rows?: Json
          sort?: number
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          owner_id?: string
          rows?: Json
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      app_user_connections: {
        Row: {
          connection_key_ciphertext: string
          connector_id: string
          created_at: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          connection_key_ciphertext: string
          connector_id: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          connection_key_ciphertext?: string
          connector_id?: string
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      attendance_devices: {
        Row: {
          approved: boolean
          created_at: string
          last_seen: string | null
          name: string
          serial_number: string
        }
        Insert: {
          approved?: boolean
          created_at?: string
          last_seen?: string | null
          name?: string
          serial_number: string
        }
        Update: {
          approved?: boolean
          created_at?: string
          last_seen?: string | null
          name?: string
          serial_number?: string
        }
        Relationships: []
      }
      attendance_logs: {
        Row: {
          created_at: string
          device_sn: string
          device_user_id: string
          distance_m: number | null
          id: string
          lat: number | null
          lng: number | null
          photo_path: string | null
          punched_at: string
          site_name: string | null
          source: string
          status: number | null
        }
        Insert: {
          created_at?: string
          device_sn: string
          device_user_id: string
          distance_m?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          photo_path?: string | null
          punched_at: string
          site_name?: string | null
          source?: string
          status?: number | null
        }
        Update: {
          created_at?: string
          device_sn?: string
          device_user_id?: string
          distance_m?: number | null
          id?: string
          lat?: number | null
          lng?: number | null
          photo_path?: string | null
          punched_at?: string
          site_name?: string | null
          source?: string
          status?: number | null
        }
        Relationships: []
      }
      bank_connections: {
        Row: {
          bank_name: string
          connected_at: string | null
          created_at: string
          customer_id: string
          entity_id: string | null
          id: string
          status: string
        }
        Insert: {
          bank_name?: string
          connected_at?: string | null
          created_at?: string
          customer_id: string
          entity_id?: string | null
          id?: string
          status?: string
        }
        Update: {
          bank_name?: string
          connected_at?: string | null
          created_at?: string
          customer_id?: string
          entity_id?: string | null
          id?: string
          status?: string
        }
        Relationships: []
      }
      bank_snapshots: {
        Row: {
          account_name: string
          available: number | null
          balance: number
          connection_id: string
          currency: string
          fetched_at: string
          id: string
          transactions: Json
        }
        Insert: {
          account_name?: string
          available?: number | null
          balance?: number
          connection_id: string
          currency?: string
          fetched_at?: string
          id?: string
          transactions?: Json
        }
        Update: {
          account_name?: string
          available?: number | null
          balance?: number
          connection_id?: string
          currency?: string
          fetched_at?: string
          id?: string
          transactions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "bank_snapshots_connection_id_fkey"
            columns: ["connection_id"]
            isOneToOne: false
            referencedRelation: "bank_connections"
            referencedColumns: ["id"]
          },
        ]
      }
      department_managers: {
        Row: {
          dept: string
          user_id: string
          user_name: string
        }
        Insert: {
          dept: string
          user_id: string
          user_name?: string
        }
        Update: {
          dept?: string
          user_id?: string
          user_name?: string
        }
        Relationships: []
      }
      direct_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          read_at: string | null
          recipient_id: string
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id: string
          sender_id?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      employees: {
        Row: {
          active: boolean
          allowances: number
          base: number
          checkin_token: string | null
          created_at: string
          deductions: number
          dept: string
          device_user_id: string | null
          email: string | null
          id: string
          joined: string | null
          name: string
          paid_months: string[]
          project: string
          role: string
          site_id: string | null
        }
        Insert: {
          active?: boolean
          allowances?: number
          base?: number
          checkin_token?: string | null
          created_at?: string
          deductions?: number
          dept?: string
          device_user_id?: string | null
          email?: string | null
          id: string
          joined?: string | null
          name: string
          paid_months?: string[]
          project?: string
          role?: string
          site_id?: string | null
        }
        Update: {
          active?: boolean
          allowances?: number
          base?: number
          checkin_token?: string | null
          created_at?: string
          deductions?: number
          dept?: string
          device_user_id?: string | null
          email?: string | null
          id?: string
          joined?: string | null
          name?: string
          paid_months?: string[]
          project?: string
          role?: string
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "employees_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "work_sites"
            referencedColumns: ["id"]
          },
        ]
      }
      exec_snapshot: {
        Row: {
          data: Json
          key: string
          updated_at: string
        }
        Insert: {
          data?: Json
          key: string
          updated_at?: string
        }
        Update: {
          data?: Json
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
      hr_records: {
        Row: {
          data: Json
          id: string
          sheet: string
          sort: number
          updated_at: string
        }
        Insert: {
          data?: Json
          id?: string
          sheet: string
          sort?: number
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: string
          sheet?: string
          sort?: number
          updated_at?: string
        }
        Relationships: []
      }
      late_excuses: {
        Row: {
          created_at: string
          created_by: string | null
          employee_id: string
          excuse_date: string
          id: string
          reason: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          employee_id: string
          excuse_date: string
          id?: string
          reason?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          employee_id?: string
          excuse_date?: string
          id?: string
          reason?: string
        }
        Relationships: []
      }
      leave_balance_adjustments: {
        Row: {
          actor_id: string | null
          actor_name: string
          created_at: string
          days: number
          employee_id: string
          id: string
          kind: string
          note: string
        }
        Insert: {
          actor_id?: string | null
          actor_name?: string
          created_at?: string
          days: number
          employee_id: string
          id?: string
          kind?: string
          note?: string
        }
        Update: {
          actor_id?: string | null
          actor_name?: string
          created_at?: string
          days?: number
          employee_id?: string
          id?: string
          kind?: string
          note?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_balance_adjustments_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_notifications: {
        Row: {
          audience: string
          created_at: string
          dept: string | null
          employee_id: string | null
          id: string
          message: string
          request_id: string | null
        }
        Insert: {
          audience: string
          created_at?: string
          dept?: string | null
          employee_id?: string | null
          id?: string
          message: string
          request_id?: string | null
        }
        Update: {
          audience?: string
          created_at?: string
          dept?: string | null
          employee_id?: string | null
          id?: string
          message?: string
          request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_notifications_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_request_events: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string
          created_at: string
          from_status: string | null
          id: string
          note: string | null
          request_id: string
          to_status: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          request_id: string
          to_status?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string
          created_at?: string
          from_status?: string | null
          id?: string
          note?: string | null
          request_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leave_request_events_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "leave_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          attachment_name: string | null
          attachment_path: string | null
          created_at: string
          created_by: string | null
          employee_id: string
          end_date: string
          hr_note: string | null
          id: string
          manager_note: string | null
          reason: string
          request_no: number
          return_date: string | null
          start_date: string
          status: string
          type_id: string
          updated_at: string
          via: string
          working_days: number
        }
        Insert: {
          attachment_name?: string | null
          attachment_path?: string | null
          created_at?: string
          created_by?: string | null
          employee_id: string
          end_date: string
          hr_note?: string | null
          id?: string
          manager_note?: string | null
          reason?: string
          request_no?: never
          return_date?: string | null
          start_date: string
          status?: string
          type_id: string
          updated_at?: string
          via?: string
          working_days?: number
        }
        Update: {
          attachment_name?: string | null
          attachment_path?: string | null
          created_at?: string
          created_by?: string | null
          employee_id?: string
          end_date?: string
          hr_note?: string | null
          id?: string
          manager_note?: string | null
          reason?: string
          request_no?: never
          return_date?: string | null
          start_date?: string
          status?: string
          type_id?: string
          updated_at?: string
          via?: string
          working_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leave_requests_type_id_fkey"
            columns: ["type_id"]
            isOneToOne: false
            referencedRelation: "leave_types"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_settings: {
        Row: {
          accrual_from: string
          id: number
          tiers: Json
          weekend: number[]
        }
        Insert: {
          accrual_from?: string
          id?: number
          tiers?: Json
          weekend?: number[]
        }
        Update: {
          accrual_from?: string
          id?: number
          tiers?: Json
          weekend?: number[]
        }
        Relationships: []
      }
      leave_types: {
        Row: {
          active: boolean
          calendar_days: boolean
          id: string
          max_days: number | null
          name_ar: string
          name_en: string
          paid: boolean
          requires_attachment: boolean
          sort: number
          uses_balance: boolean
        }
        Insert: {
          active?: boolean
          calendar_days?: boolean
          id: string
          max_days?: number | null
          name_ar: string
          name_en: string
          paid?: boolean
          requires_attachment?: boolean
          sort?: number
          uses_balance?: boolean
        }
        Update: {
          active?: boolean
          calendar_days?: boolean
          id?: string
          max_days?: number | null
          name_ar?: string
          name_en?: string
          paid?: boolean
          requires_attachment?: boolean
          sort?: number
          uses_balance?: boolean
        }
        Relationships: []
      }
      location_pings: {
        Row: {
          accuracy_m: number | null
          distance_m: number | null
          employee_id: string
          id: string
          lat: number
          lng: number
          pinged_at: string
        }
        Insert: {
          accuracy_m?: number | null
          distance_m?: number | null
          employee_id: string
          id?: string
          lat: number
          lng: number
          pinged_at?: string
        }
        Update: {
          accuracy_m?: number | null
          distance_m?: number | null
          employee_id?: string
          id?: string
          lat?: number
          lng?: number
          pinged_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "location_pings_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      mgr_projects: {
        Row: {
          client: string
          code: string
          contract: number
          created_at: string
          end_date: string | null
          id: string
          issues: string
          name: string
          notes: string
          owner_id: string
          owner_name: string
          paid: number
          progress: number
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client?: string
          code?: string
          contract?: number
          created_at?: string
          end_date?: string | null
          id?: string
          issues?: string
          name: string
          notes?: string
          owner_id?: string
          owner_name?: string
          paid?: number
          progress?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client?: string
          code?: string
          contract?: number
          created_at?: string
          end_date?: string | null
          id?: string
          issues?: string
          name?: string
          notes?: string
          owner_id?: string
          owner_name?: string
          paid?: number
          progress?: number
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      mgr_reports: {
        Row: {
          amount: number | null
          body: string
          created_at: string
          direction: string | null
          file_name: string | null
          file_path: string | null
          id: string
          kind: string
          owner_id: string
          progress: number | null
          project_id: string
        }
        Insert: {
          amount?: number | null
          body?: string
          created_at?: string
          direction?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          kind?: string
          owner_id?: string
          progress?: number | null
          project_id: string
        }
        Update: {
          amount?: number | null
          body?: string
          created_at?: string
          direction?: string | null
          file_name?: string | null
          file_path?: string | null
          id?: string
          kind?: string
          owner_id?: string
          progress?: number | null
          project_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mgr_reports_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "mgr_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_reviews: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          development_plan: string
          employee_id: string
          id: string
          manager_notes: string
          quarter: number
          review_date: string | null
          reviewer_name: string
          scores: Json
          status: string
          total: number
          updated_at: string
          year: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          development_plan?: string
          employee_id: string
          id?: string
          manager_notes?: string
          quarter: number
          review_date?: string | null
          reviewer_name?: string
          scores?: Json
          status?: string
          total?: number
          updated_at?: string
          year: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          development_plan?: string
          employee_id?: string
          id?: string
          manager_notes?: string
          quarter?: number
          review_date?: string | null
          reviewer_name?: string
          scores?: Json
          status?: string
          total?: number
          updated_at?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "performance_reviews_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string
          email: string
          employee_id: string | null
          id: string
        }
        Insert: {
          created_at?: string
          display_name?: string
          email?: string
          employee_id?: string | null
          id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string
          employee_id?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
        ]
      }
      residencies: {
        Row: {
          contract_expiry: string | null
          created_at: string
          id: string
          insurance_expiry: string | null
          iqama_expiry: string | null
          iqama_fee: number | null
          iqama_no: string | null
          job: string | null
          name: string
          nationality: string | null
          permit_expiry: string | null
          permit_fee: number | null
        }
        Insert: {
          contract_expiry?: string | null
          created_at?: string
          id?: string
          insurance_expiry?: string | null
          iqama_expiry?: string | null
          iqama_fee?: number | null
          iqama_no?: string | null
          job?: string | null
          name: string
          nationality?: string | null
          permit_expiry?: string | null
          permit_fee?: number | null
        }
        Update: {
          contract_expiry?: string | null
          created_at?: string
          id?: string
          insurance_expiry?: string | null
          iqama_expiry?: string | null
          iqama_fee?: number | null
          iqama_no?: string | null
          job?: string | null
          name?: string
          nationality?: string | null
          permit_expiry?: string | null
          permit_fee?: number | null
        }
        Relationships: []
      }
      settlements: {
        Row: {
          created_at: string
          created_by: string | null
          deductions: number
          employee_id: string
          employee_name: string
          eos: number
          id: string
          joined: string | null
          last_day: string
          leave_days: number
          leave_pay: number
          net: number
          notes: string
          other_dues: number
          reason: string
          status: string
          updated_at: string
          wage: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          deductions?: number
          employee_id: string
          employee_name: string
          eos?: number
          id?: string
          joined?: string | null
          last_day: string
          leave_days?: number
          leave_pay?: number
          net?: number
          notes?: string
          other_dues?: number
          reason: string
          status?: string
          updated_at?: string
          wage?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          deductions?: number
          employee_id?: string
          employee_name?: string
          eos?: number
          id?: string
          joined?: string | null
          last_day?: string
          leave_days?: number
          leave_pay?: number
          net?: number
          notes?: string
          other_dues?: number
          reason?: string
          status?: string
          updated_at?: string
          wage?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      work_sites: {
        Row: {
          created_at: string
          id: string
          lat: number
          lng: number
          name: string
          radius_m: number
        }
        Insert: {
          created_at?: string
          id?: string
          lat: number
          lng: number
          name: string
          radius_m?: number
        }
        Update: {
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          radius_m?: number
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      chat_directory: {
        Args: never
        Returns: {
          display_name: string
          id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_dept_manager: {
        Args: { _dept: string; _uid: string }
        Returns: boolean
      }
      is_hr: { Args: { _user_id: string }; Returns: boolean }
      leave_actor_name: { Args: { _uid: string }; Returns: string }
      leave_adjust: {
        Args: { p_days: number; p_emp: string; p_kind: string; p_note: string }
        Returns: undefined
      }
      leave_balances: {
        Args: never
        Returns: {
          adjustments: number
          booked: number
          earned: number
          employee_id: string
          entitlement: number
          joined: string
          opening: number
          remaining: number
          used: number
        }[]
      }
      leave_can_approve: { Args: { _uid: string }; Returns: boolean }
      leave_create: {
        Args: {
          p_attach_name?: string
          p_attach_path?: string
          p_emp: string
          p_end: string
          p_reason: string
          p_return?: string
          p_start: string
          p_submit?: boolean
          p_type: string
        }
        Returns: string
      }
      leave_is_weekend: { Args: { _d: string }; Returns: boolean }
      leave_log: {
        Args: {
          _action: string
          _from: string
          _note: string
          _req: string
          _to: string
        }
        Returns: undefined
      }
      leave_next_workday: { Args: { _d: string }; Returns: string }
      leave_transition: {
        Args: {
          p_action: string
          p_emp?: string
          p_id: string
          p_note?: string
        }
        Returns: string
      }
      leave_working_days: {
        Args: { _calendar: boolean; _end: string; _start: string }
        Returns: number
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "viewer"
        | "hr"
        | "manager"
        | "accountant"
        | "executive"
        | "mail"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: [
        "admin",
        "viewer",
        "hr",
        "manager",
        "accountant",
        "executive",
        "mail",
      ],
    },
  },
} as const
