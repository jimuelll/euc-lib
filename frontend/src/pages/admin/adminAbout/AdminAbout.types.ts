import type { StaffMember, LibrarySpace } from "@/services/about.service";

export interface AboutForm {
  library_name:  string;
  established:   string;
  mission_title: string;
  mission_text:  string;
  history_title: string;
  history_text:  string;
  policies:      string[];
  facilities:    string[];
  staff:         StaffMember[];
  spaces:        LibrarySpace[];
}

export const EMPTY_ABOUT_FORM: AboutForm = {
  library_name:  "",
  established:   "",
  mission_title: "",
  mission_text:  "",
  history_title: "",
  history_text:  "",
  policies:      [],
  facilities:    [],
  staff:         [],
  spaces:        [],
};