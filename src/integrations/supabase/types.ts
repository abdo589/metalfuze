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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_hr: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "viewer" | "hr" | "manager"
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
      app_role: ["admin", "viewer", "hr", "manager"],
    },
  },
} as const
