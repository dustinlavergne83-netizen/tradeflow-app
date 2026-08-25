import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";

const logoImage = "/LOGOD.jpg";
const ACCENT = "#fc6b04";
const BRAND_DARK = "#0b3ea8";
const CLOVER_PUBLIC_KEY = import.meta.env.VITE_CLOVER_PUBLIC_KEY || "";
const pg  = { minHeight:"100vh", background:"#f3f4f6", padding:"12px", fontFamily:"sans-serif" };
const crd = { maxWidth:520, margin:"0 auto", background:"#fff", borderRadius:12, padding:"28px 20px", boxShadow:"0 2px 12px rgba(0,0,0,0.1)" };

function Logo() {
  return <div style={{textAlign:"center",marginBottom:20}}><img src={logoImage} alt="DML Electrical" style={{maxWidth:180,width:"100%"}} /></div>;
}
function Footer() {
  return <p style={{textAlign:"center",fontSize:12,color:"#bbb",marginTop:20}}>DML Electrical Service, LLC (337) 288-0395 info@dmlelectrical.com</p>;
}

export default function ProposalPayDeposit() {
  const [searchParams] = useSearchParams();
  const proposalId = searchParams.get("proposalId");
  const [proposal,setProposal]=useState(null);
  const [project,setProject]=useState(null);
  const [loading,setLoading]=useState(true);
  const [loadErr,setLoadErr]=useState("");
  const [showPayForm,setShowPayForm]=useState(false);
  const [sdkReady,setSdkReady]=useState(false);
  const [cloverObj,setCloverObj]=useState(null);
  const [paying,setPaying]=useState(false);
  const [paySuccess,setPaySuccess]=useState(false);
  const [payError,setPayError]=useState("");
  const cardMountRef=useRef(null);  useEffect(()=>{if(proposalId)loadProposal();},[proposalId]);
  async function loadProposal(){
    try{
      const{data,error:err}=await supabase.from("proposals").select("*").eq("id",proposalId).single();
      if(err)throw err;
      if(!data.deposit_required)throw new Error("No deposit required on this proposal.");
      setProposal(data);
      if(data.project_id){
        const{data:proj}=await supabase.from("projects").select("name,customer").eq("id",data.project_id).single();
        if(proj)setProject(proj);
      }
    }catch(e){setLoadErr(e.message||"Unable to load proposal.");}
    finally{setLoading(false);}
  }
  useEffect(()=>{
    if(!showPayForm)return;
    if(window.Clover){setSdkReady(true);return;}
    if(document.getElementById("clover-sdk"))return;
    const s=document.createElement("script");
    s.id="clover-sdk";s.src="https://checkout.clover.com/sdk.js";s.async=true;
    s.onload=()=>setSdkReady(true);
    s.onerror=()=>setPayError("Failed to load payment SDK.");
    document.head.appendChild(s);
  },[showPayForm]);
  useEffect(()=>{
    if(!sdkReady||!showPayForm)return;
    if(!CLOVER_PUBLIC_KEY){setPayError("Payment not configured.");return;}
    const tid=setTimeout(()=>{
      if(!cardMountRef.current)return;
      try{
        const inst=new window.Clover(CLOVER_PUBLIC_KEY);
        const el=inst.elements().create("CARD",{styles:{body:{fontFamily:"sans-serif",fontSize:"15px",color:"#111"}}});
        el.mount(cardMountRef.current);
        setCloverObj({instance:inst,card:el});
      }catch{setPayError("Could not initialise payment form.");}
    },80);
    return()=>clearTimeout(tid);
  },[sdkReady,showPayForm]);  async function handlePay(){
    if(!cloverObj)return;
    setPaying(true);setPayError("");
    try{
      const result=await cloverObj.instance.createToken();
      if(result.errors)throw new Error(Object.values(result.errors).filter(Boolean).join(". ")||"Card validation failed.");
      if(!result.token)throw new Error("No card token returned.");
      const{data,error:fnErr}=await supabase.functions.invoke("create-clover-deposit",{body:{proposalId,token:result.token}});
      if(fnErr){let m=fnErr.message;try{const b=await fnErr.context?.json();if(b?.error)m=b.error;}catch(_){}throw new Error(m);}
      if(data?.error)throw new Error(data.error);
      setPaySuccess(true);setShowPayForm(false);
      setProposal(prev=>({...prev,deposit_paid:true}));
    }catch(e){setPayError(e.message||"Payment failed. Please try again.");}
    finally{setPaying(false);}
  }
  const fmt=(n)=>"$"+Number(n||0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,",");
  const depositDollars=proposal?(parseFloat(proposal.deposit_percent||0)/100)*parseFloat(proposal.total_amount||0):0;
  if(loading)return <div style={pg}><div style={crd}><Logo/><p style={{textAlign:"center",padding:"40px 0",color:"#666"}}>Loading...</p></div></div>;
  if(loadErr)return <div style={pg}><div style={crd}><Logo/><p style={{textAlign:"center",color:"#ef4444",marginTop:20}}>{loadErr}</p></div></div>;
  if(paySuccess)return(
    <div style={pg}><div style={crd}>
      <Logo/>
      <div style={{textAlign:"center",marginBottom:20}}>
        <div style={{width:72,height:72,borderRadius:"50%",background:"#dcfce7",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 12px",fontSize:32,color:"#16a34a",fontWeight:700}}>&#10003;</div>
        <h1 style={{fontSize:22,fontWeight:"bold",color:"#16a34a",margin:"0 0 8px"}}>Deposit Received!</h1>
        <p style={{fontSize:14,color:"#555",margin:0}}>Your deposit of <strong>{fmt(depositDollars)}</strong> has been processed.</p>
      </div>
      <Footer/>
    </div></div>
  );  return(
    <div style={pg}><div style={crd}>
      <Logo/>
      <h2 style={{textAlign:"center",fontSize:20,fontWeight:700,color:BRAND_DARK,margin:"0 0 4px"}}>Proposal Deposit</h2>
      <p style={{textAlign:"center",fontSize:13,color:"#666",margin:"0 0 20px"}}>Pay your deposit securely by credit card</p>
      <div style={{background:"#f9fafb",borderRadius:10,padding:"14px 18px",marginBottom:20,borderLeft:"4px solid "+ACCENT}}>
        {project?.name&&<div style={{fontSize:15,fontWeight:700,color:"#111",marginBottom:6}}>{project.name}</div>}
        {proposal?.contractor_name&&<div style={{fontSize:13,color:"#666",marginBottom:4}}>Prepared for: {proposal.contractor_name}</div>}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:10,borderTop:"1px solid #e5e7eb",marginTop:8}}>
          <div>
            <div style={{fontSize:12,color:"#888"}}>Deposit ({parseFloat(proposal.deposit_percent||0).toFixed(0)}% of {fmt(proposal.total_amount)})</div>
            <div style={{fontSize:12,color:"#78350f",fontStyle:"italic",marginTop:2}}>Due upon acceptance</div>
          </div>
          <div style={{fontSize:26,fontWeight:800,color:ACCENT}}>{fmt(depositDollars)}</div>
        </div>
      </div>
      {proposal?.deposit_paid&&(
        <div style={{background:"#dcfce7",border:"1px solid #86efac",borderRadius:8,padding:"12px 16px",textAlign:"center",marginBottom:16}}>
          <span style={{fontSize:15,fontWeight:700,color:"#16a34a"}}>Deposit already paid - thank you!</span>
        </div>
      )}
      {!proposal?.deposit_paid&&!showPayForm&&(
        <button onClick={()=>setShowPayForm(true)} style={{width:"100%",padding:"14px",background:ACCENT,color:"#fff",border:"none",borderRadius:8,fontSize:16,fontWeight:700,cursor:"pointer",marginBottom:8}}>
          Pay {fmt(depositDollars)} by Credit Card
        </button>
      )}
      {!proposal?.deposit_paid&&showPayForm&&(
        <div>
          <p style={{fontSize:13,color:"#555",marginBottom:12,textAlign:"center"}}>Enter your card details below. Payment is processed securely through Clover.</p>
          <div ref={cardMountRef} style={{border:"2px solid #e5e7eb",borderRadius:8,padding:"12px 16px",marginBottom:16,minHeight:60,background:"#fff"}} />
          {!sdkReady&&!payError&&<p style={{textAlign:"center",fontSize:13,color:"#888",marginBottom:12}}>Loading payment form...</p>}
          {payError&&<div style={{background:"#fef2f2",border:"1px solid #fca5a5",borderRadius:6,padding:"10px 14px",marginBottom:12,color:"#b91c1c",fontSize:13}}>{payError}</div>}
          <button onClick={handlePay} disabled={paying||!cloverObj} style={{width:"100%",padding:"14px",background:paying?"#9ca3af":ACCENT,color:"#fff",border:"none",borderRadius:8,fontSize:16,fontWeight:700,cursor:paying?"default":"pointer",marginBottom:8}}>
            {paying?"Processing...":"Confirm Payment - "+fmt(depositDollars)}
          </button>
          <button onClick={()=>{setShowPayForm(false);setPayError("");}} style={{width:"100%",padding:"10px",background:"transparent",color:"#666",border:"1px solid #e5e7eb",borderRadius:8,fontSize:14,cursor:"pointer"}}>Cancel</button>
        </div>
      )}
      <Footer/>
    </div></div>
  );
}