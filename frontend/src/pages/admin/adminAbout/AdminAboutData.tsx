import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getAboutSettingsAdmin, updateAboutSettings } from "@/services/about.service";
import { type AboutForm, EMPTY_ABOUT_FORM } from "./AdminAbout.types";

export const useAboutData = () => {
  const [form,    setForm]    = useState<AboutForm>(EMPTY_ABOUT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    getAboutSettingsAdmin()
      .then((data) =>
        setForm({
          library_name:  data.library_name  ?? "",
          established:   data.established   ? String(data.established) : "",
          mission_title: data.mission_title ?? "",
          mission_text:  data.mission_text  ?? "",
          history_title: data.history_title ?? "",
          history_text:  data.history_text  ?? "",
          policies:      Array.isArray(data.policies)   ? data.policies   : [],
          facilities:    Array.isArray(data.facilities) ? data.facilities : [],
          staff:         Array.isArray(data.staff)      ? data.staff      : [],
          spaces:        Array.isArray(data.spaces)     ? data.spaces     : [],
        })
      )
      .catch(() => { /* keep empty defaults */ })
      .finally(() => setLoading(false));
  }, []);

  const setField = <K extends keyof AboutForm>(key: K, value: AboutForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateAboutSettings({
        ...form,
        established: form.established ? parseInt(form.established, 10) : null,
      });
      toast.success("About page updated successfully.");
    } catch {
      toast.error("Failed to save changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return { form, setField, loading, saving, handleSubmit };
};