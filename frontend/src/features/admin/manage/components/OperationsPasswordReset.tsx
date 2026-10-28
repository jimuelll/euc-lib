import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { operationsPasswordError } from "@/utils/operationsAccess";
import { resetOperationsPassword } from "../api";

export default function OperationsPasswordReset({identifier,disabled}:{identifier:string;disabled:boolean}) {
  const [open,setOpen] = useState(false);
  const [password,setPassword] = useState("");
  const [confirmation,setConfirmation] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const clear = () => {setOpen(false);setPassword("");setConfirmation("");setError("");};
  const reset = async () => {
    const validation = operationsPasswordError(password) || (password !== confirmation ? "Passwords must match." : "");
    if (validation) {setError(validation);return;}
    setBusy(true);setError("");
    try {const result=await resetOperationsPassword(identifier,password);toast.success(result.message);clear();}
    catch {setError("Could not reset the password. Try again.");}
    finally {setBusy(false);}
  };
  return <section className="users-form-section" aria-label="Reset operations password"><h3>Password</h3><p className="users-hint">An administrator manages this account’s password. Resetting it ends all existing sessions.</p>
    {!open?<Button type="button" variant="outline" disabled={disabled} onClick={()=>setOpen(true)}>Reset password</Button>:<fieldset onKeyDown={event=>{if(event.key==="Enter"){event.preventDefault();if(!disabled && !busy)void reset();}}} disabled={disabled || busy} className="users-form-grid"><legend className="sr-only">New password</legend>
      <label className="users-field"><span>New password</span><Input type="password" autoComplete="new-password" value={password} onChange={event=>setPassword(event.target.value)} /></label>
      <label className="users-field"><span>Confirm new password</span><Input type="password" autoComplete="new-password" value={confirmation} onChange={event=>setConfirmation(event.target.value)} /></label>
      {error && <p role="alert" className="users-field-error users-wide">{error}</p>}
      <div className="users-wide flex gap-2"><Button type="button" onClick={()=>void reset()}>{busy?'Resetting…':'Save new password'}</Button><Button type="button" variant="outline" onClick={clear}>Cancel</Button></div>
    </fieldset>}
  </section>;
}
