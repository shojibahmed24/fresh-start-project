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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_email: string | null
          actor_id: string | null
          actor_role: string | null
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          new_values: Json | null
          old_values: Json | null
          severity: Database["public"]["Enums"]["activity_severity"]
          summary: string
          target_id: string | null
          target_type: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          severity?: Database["public"]["Enums"]["activity_severity"]
          summary?: string
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_email?: string | null
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          new_values?: Json | null
          old_values?: Json | null
          severity?: Database["public"]["Enums"]["activity_severity"]
          summary?: string
          target_id?: string | null
          target_type?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      agent_run_steps: {
        Row: {
          agent_name: string
          attempt_count: number
          created_at: string
          duration_ms: number | null
          error_message: string | null
          finished_at: string | null
          id: string
          input: Json
          output: Json
          parent_step_id: string | null
          run_id: string
          started_at: string | null
          status: string
          step_index: number
          step_type: string
          tool_name: string | null
          user_id: string
        }
        Insert: {
          agent_name?: string
          attempt_count?: number
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          output?: Json
          parent_step_id?: string | null
          run_id: string
          started_at?: string | null
          status?: string
          step_index: number
          step_type: string
          tool_name?: string | null
          user_id: string
        }
        Update: {
          agent_name?: string
          attempt_count?: number
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          finished_at?: string | null
          id?: string
          input?: Json
          output?: Json
          parent_step_id?: string | null
          run_id?: string
          started_at?: string | null
          status?: string
          step_index?: number
          step_type?: string
          tool_name?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_run_steps_parent_step_id_fkey"
            columns: ["parent_step_id"]
            isOneToOne: false
            referencedRelation: "agent_run_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agent_run_steps_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "agent_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_runs: {
        Row: {
          completion_tokens: number
          context_summary: string | null
          created_at: string
          error_message: string | null
          events: Json
          finished_at: string | null
          id: string
          last_event_seq: number
          mode: string
          model: string
          parent_message_id: string | null
          plan: Json
          plan_approved: boolean
          project_id: string
          prompt_tokens: number
          started_at: string | null
          status: string
          total_tokens: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completion_tokens?: number
          context_summary?: string | null
          created_at?: string
          error_message?: string | null
          events?: Json
          finished_at?: string | null
          id?: string
          last_event_seq?: number
          mode?: string
          model?: string
          parent_message_id?: string | null
          plan?: Json
          plan_approved?: boolean
          project_id: string
          prompt_tokens?: number
          started_at?: string | null
          status?: string
          total_tokens?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completion_tokens?: number
          context_summary?: string | null
          created_at?: string
          error_message?: string | null
          events?: Json
          finished_at?: string | null
          id?: string
          last_event_seq?: number
          mode?: string
          model?: string
          parent_message_id?: string | null
          plan?: Json
          plan_approved?: boolean
          project_id?: string
          prompt_tokens?: number
          started_at?: string | null
          status?: string
          total_tokens?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_turn_continuations: {
        Row: {
          attempt: number
          conversation: Json
          created_at: string
          error: string | null
          files_changed: Json
          id: string
          model: string
          project_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt?: number
          conversation: Json
          created_at?: string
          error?: string | null
          files_changed?: Json
          id?: string
          model: string
          project_id: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt?: number
          conversation?: Json
          created_at?: string
          error?: string | null
          files_changed?: Json
          id?: string
          model?: string
          project_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      agent_turn_events: {
        Row: {
          continuation_id: string
          created_at: string
          event: Json
          id: number
          seq: number
          user_id: string
        }
        Insert: {
          continuation_id: string
          created_at?: string
          event: Json
          id?: number
          seq: number
          user_id: string
        }
        Update: {
          continuation_id?: string
          created_at?: string
          event?: Json
          id?: number
          seq?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_turn_events_continuation_id_fkey"
            columns: ["continuation_id"]
            isOneToOne: false
            referencedRelation: "agent_turn_continuations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_response_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          hit_count: number
          last_hit_at: string
          model: string
          response: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at?: string
          hit_count?: number
          last_hit_at?: string
          model: string
          response: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          hit_count?: number
          last_hit_at?: string
          model?: string
          response?: Json
        }
        Relationships: []
      }
      announcements: {
        Row: {
          body: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          is_active: boolean
          link_label: string | null
          link_url: string | null
          sort_order: number
          starts_at: string
          title: string
          updated_at: string
          variant: string
        }
        Insert: {
          body?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          link_label?: string | null
          link_url?: string | null
          sort_order?: number
          starts_at?: string
          title: string
          updated_at?: string
          variant?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean
          link_label?: string | null
          link_url?: string | null
          sort_order?: number
          starts_at?: string
          title?: string
          updated_at?: string
          variant?: string
        }
        Relationships: []
      }
      app_build_steps: {
        Row: {
          build_id: string
          created_at: string
          detail: string | null
          finished_at: string | null
          id: string
          label: string
          started_at: string | null
          status: string
          step_key: string
          step_order: number
        }
        Insert: {
          build_id: string
          created_at?: string
          detail?: string | null
          finished_at?: string | null
          id?: string
          label: string
          started_at?: string | null
          status?: string
          step_key: string
          step_order?: number
        }
        Update: {
          build_id?: string
          created_at?: string
          detail?: string | null
          finished_at?: string | null
          id?: string
          label?: string
          started_at?: string | null
          status?: string
          step_key?: string
          step_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "app_build_steps_build_id_fkey"
            columns: ["build_id"]
            isOneToOne: false
            referencedRelation: "app_builds"
            referencedColumns: ["id"]
          },
        ]
      }
      app_builds: {
        Row: {
          app_name: string
          created_at: string
          download_url: string | null
          error_message: string | null
          file_size_bytes: number | null
          finished_at: string | null
          github_run_id: string | null
          github_run_url: string | null
          id: string
          package_id: string
          platform: Database["public"]["Enums"]["build_platform"]
          project_id: string
          started_at: string | null
          status: Database["public"]["Enums"]["build_status"]
          updated_at: string
          user_id: string
          version_code: number
          version_name: string
        }
        Insert: {
          app_name?: string
          created_at?: string
          download_url?: string | null
          error_message?: string | null
          file_size_bytes?: number | null
          finished_at?: string | null
          github_run_id?: string | null
          github_run_url?: string | null
          id?: string
          package_id?: string
          platform?: Database["public"]["Enums"]["build_platform"]
          project_id: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["build_status"]
          updated_at?: string
          user_id: string
          version_code?: number
          version_name?: string
        }
        Update: {
          app_name?: string
          created_at?: string
          download_url?: string | null
          error_message?: string | null
          file_size_bytes?: number | null
          finished_at?: string | null
          github_run_id?: string | null
          github_run_url?: string | null
          id?: string
          package_id?: string
          platform?: Database["public"]["Enums"]["build_platform"]
          project_id?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["build_status"]
          updated_at?: string
          user_id?: string
          version_code?: number
          version_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "app_builds_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          contact_email: string
          contact_phone: string
          id: boolean
          invoice_prefix: string
          maintenance_message: string
          maintenance_mode: boolean
          order_auto_reject_days: number
          site_logo_url: string
          site_name: string
          updated_at: string
          vat_percent: number
        }
        Insert: {
          contact_email?: string
          contact_phone?: string
          id?: boolean
          invoice_prefix?: string
          maintenance_message?: string
          maintenance_mode?: boolean
          order_auto_reject_days?: number
          site_logo_url?: string
          site_name?: string
          updated_at?: string
          vat_percent?: number
        }
        Update: {
          contact_email?: string
          contact_phone?: string
          id?: boolean
          invoice_prefix?: string
          maintenance_message?: string
          maintenance_mode?: boolean
          order_auto_reject_days?: number
          site_logo_url?: string
          site_name?: string
          updated_at?: string
          vat_percent?: number
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json
          mode: string
          project_id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json
          mode: string
          project_id: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json
          mode?: string
          project_id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_transactions: {
        Row: {
          balance_after: number
          created_at: string
          created_by: string | null
          delta: number
          id: string
          reason: string
          reference_id: string | null
          source: Database["public"]["Enums"]["credit_source"]
          user_id: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          created_by?: string | null
          delta: number
          id?: string
          reason?: string
          reference_id?: string | null
          source: Database["public"]["Enums"]["credit_source"]
          user_id: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          created_by?: string | null
          delta?: number
          id?: string
          reason?: string
          reference_id?: string | null
          source?: Database["public"]["Enums"]["credit_source"]
          user_id?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          category: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          question: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          answer?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          question: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          answer?: string
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          question?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      feature_flags: {
        Row: {
          created_at: string
          enabled: boolean
          flag_key: string
          id: string
          metadata: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          flag_key: string
          id?: string
          metadata?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          flag_key?: string
          id?: string
          metadata?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          created_at: string
          currency: string
          id: string
          invoice_number: string
          issued_at: string
          order_id: string
          pdf_url: string | null
          subtotal: number
          total: number
          user_id: string
          vat_amount: number
          vat_percent: number
        }
        Insert: {
          created_at?: string
          currency?: string
          id?: string
          invoice_number: string
          issued_at?: string
          order_id: string
          pdf_url?: string | null
          subtotal?: number
          total?: number
          user_id: string
          vat_amount?: number
          vat_percent?: number
        }
        Update: {
          created_at?: string
          currency?: string
          id?: string
          invoice_number?: string
          issued_at?: string
          order_id?: string
          pdf_url?: string | null
          subtotal?: number
          total?: number
          user_id?: string
          vat_amount?: number
          vat_percent?: number
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          link: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          link?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      order_flags: {
        Row: {
          created_at: string
          details: Json | null
          flag_type: Database["public"]["Enums"]["fraud_flag_type"]
          id: string
          order_id: string
          reason: string
          resolution_note: string | null
          resolved: boolean
          resolved_at: string | null
          resolved_by: string | null
          severity: Database["public"]["Enums"]["activity_severity"]
          user_id: string
        }
        Insert: {
          created_at?: string
          details?: Json | null
          flag_type: Database["public"]["Enums"]["fraud_flag_type"]
          id?: string
          order_id: string
          reason?: string
          resolution_note?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["activity_severity"]
          user_id: string
        }
        Update: {
          created_at?: string
          details?: Json | null
          flag_type?: Database["public"]["Enums"]["fraud_flag_type"]
          id?: string
          order_id?: string
          reason?: string
          resolution_note?: string | null
          resolved?: boolean
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: Database["public"]["Enums"]["activity_severity"]
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          admin_notes: string | null
          amount: number
          approved_at: string | null
          created_at: string
          credits: number
          crypto_currency: string | null
          device_fingerprint: string | null
          id: string
          ip_address: string | null
          needs_review: boolean
          package_id: string
          package_name: string
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          promo_bonus_credits: number
          promo_code: string | null
          promo_discount: number
          refund_reason: string | null
          refunded_at: string | null
          refunded_credits: number | null
          risk_score: number
          sender_account: string | null
          status: Database["public"]["Enums"]["order_status"]
          transaction_id: string | null
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount: number
          approved_at?: string | null
          created_at?: string
          credits: number
          crypto_currency?: string | null
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          needs_review?: boolean
          package_id: string
          package_name: string
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          promo_bonus_credits?: number
          promo_code?: string | null
          promo_discount?: number
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_credits?: number | null
          risk_score?: number
          sender_account?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          transaction_id?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          amount?: number
          approved_at?: string | null
          created_at?: string
          credits?: number
          crypto_currency?: string | null
          device_fingerprint?: string | null
          id?: string
          ip_address?: string | null
          needs_review?: boolean
          package_id?: string
          package_name?: string
          payment_method?: Database["public"]["Enums"]["payment_method_type"]
          promo_bonus_credits?: number
          promo_code?: string | null
          promo_discount?: number
          refund_reason?: string | null
          refunded_at?: string | null
          refunded_credits?: number | null
          risk_score?: number
          sender_account?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          transaction_id?: string | null
          updated_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      packages: {
        Row: {
          created_at: string
          credits: number
          description: string | null
          id: string
          is_active: boolean
          is_popular: boolean
          name: string
          price: number
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          credits: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_popular?: boolean
          name: string
          price: number
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          credits?: number
          description?: string | null
          id?: string
          is_active?: boolean
          is_popular?: boolean
          name?: string
          price?: number
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      payment_methods: {
        Row: {
          account_number: string
          created_at: string
          id: string
          instructions: string | null
          is_active: boolean
          label: string
          type: Database["public"]["Enums"]["payment_method_type"]
          updated_at: string
        }
        Insert: {
          account_number: string
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          label: string
          type: Database["public"]["Enums"]["payment_method_type"]
          updated_at?: string
        }
        Update: {
          account_number?: string
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          label?: string
          type?: Database["public"]["Enums"]["payment_method_type"]
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          chat_mode: string
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          chat_mode?: string
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          chat_mode?: string
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      project_error_history: {
        Row: {
          created_at: string
          error_message: string
          error_stack: string
          file_path: string
          fix_kind: string
          fix_summary: string
          id: string
          project_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string
          error_stack?: string
          file_path?: string
          fix_kind?: string
          fix_summary?: string
          id?: string
          project_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string
          error_stack?: string
          file_path?: string
          fix_kind?: string
          fix_summary?: string
          id?: string
          project_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_error_history_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_files: {
        Row: {
          content: string
          created_at: string
          id: string
          path: string
          project_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          path: string
          project_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          path?: string
          project_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_files_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_memory: {
        Row: {
          category: string
          content: string
          created_at: string
          id: string
          project_id: string
          source: string
          updated_at: string
          user_id: string
          weight: number
        }
        Insert: {
          category?: string
          content: string
          created_at?: string
          id?: string
          project_id: string
          source?: string
          updated_at?: string
          user_id: string
          weight?: number
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          id?: string
          project_id?: string
          source?: string
          updated_at?: string
          user_id?: string
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "project_memory_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_plans: {
        Row: {
          app_name: string
          approved: boolean
          completed_paths: Json
          created_at: string
          data_models: Json
          description: string
          features: Json
          id: string
          last_checkpoint_at: string | null
          last_completed_path: string | null
          pending_paths: Json
          project_id: string
          run_id: string | null
          run_status: string
          screens: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          app_name?: string
          approved?: boolean
          completed_paths?: Json
          created_at?: string
          data_models?: Json
          description?: string
          features?: Json
          id?: string
          last_checkpoint_at?: string | null
          last_completed_path?: string | null
          pending_paths?: Json
          project_id: string
          run_id?: string | null
          run_status?: string
          screens?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          app_name?: string
          approved?: boolean
          completed_paths?: Json
          created_at?: string
          data_models?: Json
          description?: string
          features?: Json
          id?: string
          last_checkpoint_at?: string | null
          last_completed_path?: string | null
          pending_paths?: Json
          project_id?: string
          run_id?: string | null
          run_status?: string
          screens?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_plans_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_supabase_links: {
        Row: {
          anon_key_encrypted: string | null
          api_url: string | null
          created_at: string
          id: string
          project_id: string
          schema_cache: Json
          schema_cached_at: string | null
          service_role_key_encrypted: string | null
          supabase_org_id: string | null
          supabase_project_name: string
          supabase_project_ref: string
          supabase_region: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          anon_key_encrypted?: string | null
          api_url?: string | null
          created_at?: string
          id?: string
          project_id: string
          schema_cache?: Json
          schema_cached_at?: string | null
          service_role_key_encrypted?: string | null
          supabase_org_id?: string | null
          supabase_project_name?: string
          supabase_project_ref: string
          supabase_region?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          anon_key_encrypted?: string | null
          api_url?: string | null
          created_at?: string
          id?: string
          project_id?: string
          schema_cache?: Json
          schema_cached_at?: string | null
          service_role_key_encrypted?: string | null
          supabase_org_id?: string | null
          supabase_project_name?: string
          supabase_project_ref?: string
          supabase_region?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_supabase_links_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: true
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          pinned: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          pinned?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          pinned?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          applicable_package_ids: string[]
          bonus_credits: number
          code: string
          created_at: string
          created_by: string | null
          description: string
          discount_type: Database["public"]["Enums"]["promo_discount_type"]
          discount_value: number
          expires_at: string | null
          id: string
          is_active: boolean
          max_discount: number | null
          min_amount: number
          per_user_limit: number
          starts_at: string
          updated_at: string
          usage_limit: number | null
          used_count: number
        }
        Insert: {
          applicable_package_ids?: string[]
          bonus_credits?: number
          code: string
          created_at?: string
          created_by?: string | null
          description?: string
          discount_type: Database["public"]["Enums"]["promo_discount_type"]
          discount_value: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_amount?: number
          per_user_limit?: number
          starts_at?: string
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
        }
        Update: {
          applicable_package_ids?: string[]
          bonus_credits?: number
          code?: string
          created_at?: string
          created_by?: string | null
          description?: string
          discount_type?: Database["public"]["Enums"]["promo_discount_type"]
          discount_value?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_discount?: number | null
          min_amount?: number
          per_user_limit?: number
          starts_at?: string
          updated_at?: string
          usage_limit?: number | null
          used_count?: number
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          bonus_credits: number
          discount_amount: number
          id: string
          order_id: string | null
          promo_id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          bonus_credits?: number
          discount_amount?: number
          id?: string
          order_id?: string | null
          promo_id: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          bonus_credits?: number
          discount_amount?: number
          id?: string
          order_id?: string | null
          promo_id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_redemptions_promo_id_fkey"
            columns: ["promo_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      supabase_operation_logs: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          metadata: Json | null
          operation: string
          project_id: string | null
          request_summary: string
          status: string
          supabase_project_ref: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          operation: string
          project_id?: string | null
          request_summary?: string
          status?: string
          supabase_project_ref?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          metadata?: Json | null
          operation?: string
          project_id?: string | null
          request_summary?: string
          status?: string
          supabase_project_ref?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "supabase_operation_logs_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      support_messages: {
        Row: {
          attachment_url: string | null
          body: string
          created_at: string
          id: string
          sender_email: string | null
          sender_id: string | null
          sender_type: Database["public"]["Enums"]["support_sender_type"]
          ticket_id: string
        }
        Insert: {
          attachment_url?: string | null
          body: string
          created_at?: string
          id?: string
          sender_email?: string | null
          sender_id?: string | null
          sender_type: Database["public"]["Enums"]["support_sender_type"]
          ticket_id: string
        }
        Update: {
          attachment_url?: string | null
          body?: string
          created_at?: string
          id?: string
          sender_email?: string | null
          sender_id?: string | null
          sender_type?: Database["public"]["Enums"]["support_sender_type"]
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "support_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      support_tickets: {
        Row: {
          admin_unread_count: number
          closed_at: string | null
          created_at: string
          id: string
          last_message_at: string
          last_message_preview: string
          last_sender: Database["public"]["Enums"]["support_sender_type"]
          message_count: number
          priority: Database["public"]["Enums"]["support_ticket_priority"]
          status: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          updated_at: string
          user_id: string
          user_unread_count: number
        }
        Insert: {
          admin_unread_count?: number
          closed_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string
          last_sender?: Database["public"]["Enums"]["support_sender_type"]
          message_count?: number
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          updated_at?: string
          user_id: string
          user_unread_count?: number
        }
        Update: {
          admin_unread_count?: number
          closed_at?: string | null
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string
          last_sender?: Database["public"]["Enums"]["support_sender_type"]
          message_count?: number
          priority?: Database["public"]["Enums"]["support_ticket_priority"]
          status?: Database["public"]["Enums"]["support_ticket_status"]
          subject?: string
          updated_at?: string
          user_id?: string
          user_unread_count?: number
        }
        Relationships: []
      }
      user_bans: {
        Row: {
          banned_at: string
          banned_by: string
          reason: string
          user_id: string
        }
        Insert: {
          banned_at?: string
          banned_by: string
          reason?: string
          user_id: string
        }
        Update: {
          banned_at?: string
          banned_by?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      user_credits: {
        Row: {
          balance: number
          total_purchased: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          total_purchased?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          total_purchased?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_supabase_connections: {
        Row: {
          access_token_encrypted: string
          connected_at: string
          created_at: string
          id: string
          last_refreshed_at: string
          refresh_token_encrypted: string
          revoked: boolean
          scopes: string[]
          supabase_email: string | null
          supabase_user_id: string | null
          token_expires_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted: string
          connected_at?: string
          created_at?: string
          id?: string
          last_refreshed_at?: string
          refresh_token_encrypted: string
          revoked?: boolean
          scopes?: string[]
          supabase_email?: string | null
          supabase_user_id?: string | null
          token_expires_at: string
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string
          connected_at?: string
          created_at?: string
          id?: string
          last_refreshed_at?: string
          refresh_token_encrypted?: string
          revoked?: boolean
          scopes?: string[]
          supabase_email?: string | null
          supabase_user_id?: string | null
          token_expires_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_adjust_credits: {
        Args: { _delta: number; _reason?: string; _user_id: string }
        Returns: undefined
      }
      admin_ban_user: {
        Args: { _reason?: string; _user_id: string }
        Returns: undefined
      }
      admin_bulk_adjust_prices: {
        Args: {
          _flat_delta?: number
          _package_ids: string[]
          _percent?: number
          _round_to?: number
        }
        Returns: number
      }
      admin_bulk_approve_orders: {
        Args: { _order_ids: string[] }
        Returns: number
      }
      admin_bulk_reject_orders: {
        Args: { _order_ids: string[]; _reason?: string }
        Returns: number
      }
      admin_bulk_set_package_active: {
        Args: { _active: boolean; _package_ids: string[] }
        Returns: number
      }
      admin_create_manual_order: {
        Args: {
          _amount?: number
          _credits: number
          _notes?: string
          _package_id: string
          _package_name?: string
          _payment_method?: Database["public"]["Enums"]["payment_method_type"]
          _user_id: string
        }
        Returns: string
      }
      admin_fraud_stats: { Args: never; Returns: Json }
      admin_get_activity_alerts: { Args: never; Returns: Json }
      admin_get_analytics: { Args: never; Returns: Json }
      admin_list_activity: {
        Args: {
          _action?: string
          _actor_id?: string
          _from?: string
          _limit?: number
          _search?: string
          _severity?: Database["public"]["Enums"]["activity_severity"]
          _target_id?: string
          _target_type?: string
          _to?: string
        }
        Returns: {
          action: string
          actor_email: string
          actor_id: string
          actor_role: string
          created_at: string
          id: string
          ip_address: string
          metadata: Json
          new_values: Json
          old_values: Json
          severity: Database["public"]["Enums"]["activity_severity"]
          summary: string
          target_id: string
          target_type: string
          user_agent: string
        }[]
      }
      admin_list_credit_transactions: {
        Args: {
          _from?: string
          _limit?: number
          _source?: Database["public"]["Enums"]["credit_source"]
          _to?: string
          _user_id?: string
        }
        Returns: {
          balance_after: number
          created_at: string
          delta: number
          display_name: string
          email: string
          id: string
          reason: string
          reference_id: string
          source: Database["public"]["Enums"]["credit_source"]
          user_id: string
        }[]
      }
      admin_list_flagged_orders: {
        Args: { _limit?: number; _resolved?: boolean }
        Returns: {
          amount: number
          created_at: string
          display_name: string
          flag_count: number
          flag_types: string[]
          flags: Json
          ip_address: string
          max_severity: Database["public"]["Enums"]["activity_severity"]
          needs_review: boolean
          order_id: string
          package_name: string
          payment_method: Database["public"]["Enums"]["payment_method_type"]
          risk_score: number
          sender_account: string
          status: Database["public"]["Enums"]["order_status"]
          transaction_id: string
          user_email: string
          user_id: string
        }[]
      }
      admin_list_tickets: {
        Args: {
          _limit?: number
          _status?: Database["public"]["Enums"]["support_ticket_status"]
        }
        Returns: {
          admin_unread_count: number
          created_at: string
          display_name: string
          id: string
          last_message_at: string
          last_message_preview: string
          last_sender: Database["public"]["Enums"]["support_sender_type"]
          message_count: number
          priority: Database["public"]["Enums"]["support_ticket_priority"]
          status: Database["public"]["Enums"]["support_ticket_status"]
          subject: string
          user_email: string
          user_id: string
          user_unread_count: number
        }[]
      }
      admin_list_users: {
        Args: never
        Returns: {
          avatar_url: string
          ban_reason: string
          created_at: string
          credit_balance: number
          display_name: string
          email: string
          is_admin: boolean
          is_banned: boolean
          order_count: number
          total_purchased: number
          total_spent: number
          user_id: string
        }[]
      }
      admin_refund_order: {
        Args: { _order_id: string; _reason?: string }
        Returns: undefined
      }
      admin_resolve_flag: {
        Args: { _flag_id: string; _note?: string }
        Returns: undefined
      }
      admin_resolve_order_flags: {
        Args: { _note?: string; _order_id: string }
        Returns: number
      }
      admin_set_ban: {
        Args: { _ban: boolean; _reason?: string; _user_id: string }
        Returns: undefined
      }
      admin_set_role: {
        Args: { _make_admin: boolean; _user_id: string }
        Returns: undefined
      }
      admin_support_stats: { Args: never; Returns: Json }
      admin_unban_user: { Args: { _user_id: string }; Returns: undefined }
      auto_reject_stale_orders: { Args: never; Returns: number }
      auto_reject_stale_orders_cron: { Args: never; Returns: number }
      cleanup_ai_cache: { Args: never; Returns: number }
      consume_credits: {
        Args: { _amount: number; _reason?: string }
        Returns: number
      }
      create_support_ticket: {
        Args: {
          _body: string
          _priority?: Database["public"]["Enums"]["support_ticket_priority"]
          _subject: string
        }
        Returns: string
      }
      get_agent_version_preference: { Args: never; Returns: boolean }
      has_feature_flag: {
        Args: { _flag_key: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      log_activity: {
        Args: {
          _action: string
          _metadata?: Json
          _new?: Json
          _old?: Json
          _severity?: Database["public"]["Enums"]["activity_severity"]
          _summary?: string
          _target_id?: string
          _target_type?: string
        }
        Returns: string
      }
      log_auth_event: {
        Args: {
          _action: string
          _email?: string
          _metadata?: Json
          _success?: boolean
        }
        Returns: string
      }
      log_credit_tx: {
        Args: {
          _created_by?: string
          _delta: number
          _reason?: string
          _reference_id?: string
          _source: Database["public"]["Enums"]["credit_source"]
          _user_id: string
        }
        Returns: undefined
      }
      mark_all_notifications_read: { Args: never; Returns: number }
      mark_ticket_read: { Args: { _ticket_id: string }; Returns: undefined }
      post_support_message: {
        Args: { _body: string; _ticket_id: string }
        Returns: string
      }
      record_project_error: {
        Args: {
          _error_message: string
          _error_stack: string
          _file_path: string
          _fix_kind: string
          _fix_summary: string
          _project_id: string
        }
        Returns: string
      }
      redeem_promo_for_order: {
        Args: { _order_id: string }
        Returns: undefined
      }
      send_notification: {
        Args: {
          _body?: string
          _link?: string
          _title: string
          _type?: string
          _user_id: string
        }
        Returns: string
      }
      set_agent_version_preference: {
        Args: { _use_v2: boolean }
        Returns: undefined
      }
      set_ticket_status: {
        Args: {
          _status: Database["public"]["Enums"]["support_ticket_status"]
          _ticket_id: string
        }
        Returns: undefined
      }
      validate_promo: {
        Args: { _amount: number; _code: string; _package_id: string }
        Returns: {
          bonus_credits: number
          discount_amount: number
          final_amount: number
          message: string
          promo_id: string
        }[]
      }
    }
    Enums: {
      activity_severity: "info" | "warn" | "critical"
      app_role: "admin" | "user"
      build_platform: "android" | "ios"
      build_status:
        | "queued"
        | "preparing"
        | "building"
        | "uploading"
        | "ready"
        | "failed"
        | "cancelled"
      credit_source:
        | "purchase"
        | "admin_gift"
        | "admin_deduct"
        | "refund"
        | "ai_usage"
        | "promo_bonus"
        | "signup_bonus"
      fraud_flag_type:
        | "duplicate_txid"
        | "repeat_account"
        | "repeat_ip"
        | "velocity"
        | "banned_user"
        | "mismatched_account"
        | "high_risk_score"
      order_status: "pending" | "approved" | "rejected" | "refunded"
      payment_method_type: "bkash" | "nagad" | "rocket" | "crypto"
      promo_discount_type: "percent" | "flat"
      support_sender_type: "user" | "admin" | "system"
      support_ticket_priority: "low" | "normal" | "high" | "urgent"
      support_ticket_status: "open" | "pending" | "resolved" | "closed"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      activity_severity: ["info", "warn", "critical"],
      app_role: ["admin", "user"],
      build_platform: ["android", "ios"],
      build_status: [
        "queued",
        "preparing",
        "building",
        "uploading",
        "ready",
        "failed",
        "cancelled",
      ],
      credit_source: [
        "purchase",
        "admin_gift",
        "admin_deduct",
        "refund",
        "ai_usage",
        "promo_bonus",
        "signup_bonus",
      ],
      fraud_flag_type: [
        "duplicate_txid",
        "repeat_account",
        "repeat_ip",
        "velocity",
        "banned_user",
        "mismatched_account",
        "high_risk_score",
      ],
      order_status: ["pending", "approved", "rejected", "refunded"],
      payment_method_type: ["bkash", "nagad", "rocket", "crypto"],
      promo_discount_type: ["percent", "flat"],
      support_sender_type: ["user", "admin", "system"],
      support_ticket_priority: ["low", "normal", "high", "urgent"],
      support_ticket_status: ["open", "pending", "resolved", "closed"],
    },
  },
} as const
