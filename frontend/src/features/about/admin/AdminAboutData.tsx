import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAboutSettingsAdmin, updateAboutSettings } from "@/features/about/api/about.service";
import { type AboutForm, EMPTY_ABOUT_FORM } from "./AdminAbout.types";
import { aboutKeys } from "../about.keys";

export const useAboutData = () => {
  const [form,    setForm]    = useState<AboutForm>(EMPTY_ABOUT_FORM);
  const queryClient = useQueryClient();
  const aboutQuery = useQuery({ queryKey: aboutKeys.admin(), queryFn: ({ signal }) => getAboutSettingsAdmin(signal) });
  const saveMutation = useMutation({ mutationFn: updateAboutSettings, onSuccess: () => queryClient.invalidateQueries({ queryKey: aboutKeys.all }) });
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (!aboutQuery.data || initialized) return;
    const data = aboutQuery.data;
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
        });
    setInitialized(true);
  }, [aboutQuery.data, initialized]);

  const setField = <K extends keyof AboutForm>(key: K, value: AboutForm[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await saveMutation.mutateAsync({
        ...form,
        established: form.established ? parseInt(form.established, 10) : null,
      });
      toast.success("About page updated successfully.");
    } catch {
      toast.error("Failed to save changes. Please try again.");
    }
  };

  return { form, setField, loading: aboutQuery.isPending, saving: saveMutation.isPending, handleSubmit };
};
