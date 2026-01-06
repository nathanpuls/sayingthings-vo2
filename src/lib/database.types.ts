export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            custom_domains: {
                Row: {
                    id: string
                    user_id: string
                    domain: string
                    verified: boolean
                    verification_token: string | null
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    domain: string
                    verified?: boolean
                    verification_token?: string | null
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    domain?: string
                    verified?: boolean
                    verification_token?: string | null
                    created_at?: string
                    updated_at?: string
                }
            }
            demos: {
                Row: {
                    id: string
                    user_id: string
                    name: string
                    url: string
                    order: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    name: string
                    url: string
                    order: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    name?: string
                    url?: string
                    order?: number
                    created_at?: string
                }
            }
            videos: {
                Row: {
                    id: string
                    user_id: string
                    youtube_id: string
                    title: string
                    order: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    youtube_id: string
                    title: string
                    order: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    youtube_id?: string
                    title?: string
                    order?: number
                    created_at?: string
                }
            }
            studio_gear: {
                Row: {
                    id: string
                    user_id: string
                    name: string
                    url: string
                    order: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    name: string
                    url: string
                    order: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    name?: string
                    url?: string
                    order?: number
                    created_at?: string
                }
            }
            clients: {
                Row: {
                    id: string
                    user_id: string
                    url: string
                    order: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    url: string
                    order: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    url?: string
                    order?: number
                    created_at?: string
                }
            }
            reviews: {
                Row: {
                    id: string
                    user_id: string
                    text: string
                    author: string
                    order: number
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    text: string
                    author: string
                    order: number
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    text?: string
                    author?: string
                    order?: number
                    created_at?: string
                }
            }
            messages: {
                Row: {
                    id: string
                    user_id: string
                    name: string
                    email: string
                    message: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    name: string
                    email: string
                    message: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    name?: string
                    email?: string
                    message?: string
                    created_at?: string
                }
            }
            site_settings: {
                Row: {
                    user_id: string
                    hero_title: string | null
                    hero_subtitle: string | null
                    about_title: string | null
                    about_text: string | null
                    contact_email: string | null
                    contact_phone: string | null
                    site_name: string | null
                    profile_image: string | null
                    profile_cartoon: string | null
                    show_cartoon: boolean
                    clients_grayscale: boolean
                    theme_color: string | null
                    section_order: string[] | null
                    font: string | null
                    web3_forms_key: string | null
                    show_contact_form: boolean
                    hidden_sections: string[] | null
                    favicon: string | null
                    created_at: string
                }
                Insert: {
                    user_id: string
                    hero_title?: string | null
                    hero_subtitle?: string | null
                    about_title?: string | null
                    about_text?: string | null
                    contact_email?: string | null
                    contact_phone?: string | null
                    site_name?: string | null
                    profile_image?: string | null
                    profile_cartoon?: string | null
                    show_cartoon?: boolean
                    clients_grayscale?: boolean
                    theme_color?: string | null
                    section_order?: string[] | null
                    font?: string | null
                    web3_forms_key?: string | null
                    show_contact_form?: boolean
                    hidden_sections?: string[] | null
                    favicon?: string | null
                    created_at?: string
                }
                Update: {
                    user_id?: string
                    hero_title?: string | null
                    hero_subtitle?: string | null
                    about_title?: string | null
                    about_text?: string | null
                    contact_email?: string | null
                    contact_phone?: string | null
                    site_name?: string | null
                    profile_image?: string | null
                    profile_cartoon?: string | null
                    show_cartoon?: boolean
                    clients_grayscale?: boolean
                    theme_color?: string | null
                    section_order?: string[] | null
                    font?: string | null
                    web3_forms_key?: string | null
                    show_contact_form?: boolean
                    hidden_sections?: string[] | null
                    favicon?: string | null
                    created_at?: string
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}
