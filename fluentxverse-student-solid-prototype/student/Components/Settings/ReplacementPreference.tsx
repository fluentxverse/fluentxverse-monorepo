import { createSignal, onMount } from 'solid-js';
import { client } from '../../api/utils';

export default function ReplacementPreference() {
  const [enabled,setEnabled]=createSignal(false),[loading,setLoading]=createSignal(true);
  const [saving,setSaving]=createSignal(false),[error,setError]=createSignal('');
  const load=async()=>{
    setLoading(true);setError('');
    try {const {data}=await client.get('/student/replacement-preference');if(!data.success)throw Error();setEnabled(data.data.enabled===true);}
    catch {setError('Could not load your lesson preference.');}
    finally {setLoading(false);}
  };
  onMount(()=>void load());
  const change=async(value:boolean)=>{
    setSaving(true);setError('');
    try {const {data}=await client.put('/student/replacement-preference',{enabled:value});if(!data.success)throw Error();setEnabled(data.data.enabled===true);}
    catch {setError('Could not save your preference. Please try again.');}
    finally {setSaving(false);}
  };
  return <section class="account-replacement"><h3>Lesson preferences</h3>
    <label><span>Automatically find a replacement tutor</span><input type="checkbox" role="switch" checked={enabled()}
      disabled={loading()||saving()||Boolean(error()&&!enabled())} onChange={e=>{
        const value=e.currentTarget.checked;e.currentTarget.checked=enabled();void change(value);
      }}/></label>
    <p>Transfer my lesson to an available, Present tutor at the same time if my tutor does not confirm availability or marks themselves absent. No additional charge.</p>
    {saving()&&<p role="status">Saving...</p>}
    {error()&&<p role="alert">{error()} <button type="button" onClick={()=>void load()}>Retry</button></p>}
  </section>;
}
