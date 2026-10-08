import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,execute,DAY,DomainError,citizenView} from '../src/domain.ts';
import type {State} from '../src/domain.ts';
import {graduate,completeCourse} from './helpers.ts';
import {COURSES} from '../src/education.ts';
import {reconcile} from '../src/recovery.ts';
let seq=0;const start=10*DAY,owner='teacher-one',student='learner-one',now=start+8*DAY;
const run=(s:State,actor:string,type:string,payload:Record<string,unknown>={},at=now)=>execute(s,actor,{id:'teaching_test_'+ ++seq,type,payload},at);
const code=(value:string)=>(e:unknown)=>e instanceof DomainError&&e.code===value;
function setup(){let s=run(initialState(),owner,'CreateCitizen',{name:'Teacher',state:'Lagos',adultConfirmed:true},start).state;s=run(s,student,'CreateCitizen',{name:'Student',state:'Lagos',adultConfirmed:true},start).state;s=graduate(s,owner,start);s=graduate(s,student,start);s=completeCourse(s,owner,'secondary',start+5*DAY);s=completeCourse(s,owner,'business',start+6*DAY);return s;}
test('private school earnings depend on official examination and closed schools retain NPC completion',()=>{
 let s=setup();const created=run(s,owner,'RegisterCompany',{name:'Learning House',sector:'education',capital:100000});s=created.state;const companyId=String(created.receipt.detail.companyId);
 assert.throws(()=>run(s,owner,'OpenSchool',{companyId,courseIds:['medicine']}),code('TEACHER_QUALIFICATION'));
 const opened=run(s,owner,'OpenSchool',{companyId,courseIds:['secondary']});s=opened.state;const schoolId=opened.receipt.detail.schoolId,before=s.balances['company:'+companyId];
 const enrolled=run(s,student,'EnrollCourse',{courseId:'secondary',schoolId,acceptedFee:50000,acceptTerms:true});s=enrolled.state;const enrolmentId=enrolled.receipt.detail.enrolmentId;s=run(s,owner,'CloseSchool',{schoolId}).state;
 for(const [i,task] of COURSES.find(c=>c.id==='secondary')!.tasks.entries())s=run(s,student,'StudyCourse',{enrolmentId,choice:task.correct},now+(i+1)*2000).state;
 s=run(s,student,'TakeCourseExam',{enrolmentId,answers:[0,0,0,0,0]},now+60000).state;assert.equal(s.balances['company:'+companyId],before+45000);assert.ok(s.education!.enrolments[String(enrolmentId)].certificate);reconcile(s);
});
test('mentoring requires relevant licence, mutual consent and student confirmation without credential bypass',()=>{
 let s=setup();s=completeCourse(s,owner,'medicine',start+7*DAY);s=completeCourse(s,student,'secondary',start+5*DAY);
 const enrolled=run(s,student,'EnrollCourse',{courseId:'medicine',acceptedFee:200000,acceptTerms:true});s=enrolled.state;const enrolmentId=String(enrolled.receipt.detail.enrolmentId),course=COURSES.find(c=>c.id==='medicine')!;
 const invited=run(s,student,'InviteMentor',{enrolmentId,citizenId:s.citizens[owner].id});s=invited.state;const mentorshipId=invited.receipt.detail.mentorshipId;assert.throws(()=>run(s,owner,'AcceptMentorship',{mentorshipId}),code('CONSENT_REQUIRED'));s=run(s,owner,'AcceptMentorship',{mentorshipId,consent:true}).state;
 assert.throws(()=>run(s,owner,'OfferMentoredPractice',{mentorshipId,choice:0}),code('MENTOR_PERMISSION'));
 for(const [i,task] of course.tasks.entries())s=run(s,student,'StudyCourse',{enrolmentId,choice:task.correct},now+(i+1)*2000).state;s=run(s,student,'TakeCourseExam',{enrolmentId,answers:course.exam.map(q=>q.correct)},now+60000).state;
 const offered=run(s,owner,'OfferMentoredPractice',{mentorshipId,choice:0},now+61000);s=offered.state;assert.equal(s.education!.enrolments[enrolmentId].practice,0);const practiceSessionId=offered.receipt.detail.practiceSessionId;
 s=run(s,student,'SupervisedPractice',{enrolmentId,practiceSessionId,choice:0},now+62000).state;assert.equal(s.education!.enrolments[enrolmentId].practice,1);assert.throws(()=>run(s,student,'SupervisedPractice',{enrolmentId,practiceSessionId,choice:0},now+122000),code('PRACTICE_SESSION_INVALID'));
 s=run(s,student,'SupervisedPractice',{enrolmentId,choice:0},now+122000).state;s=run(s,student,'SupervisedPractice',{enrolmentId,choice:0},now+182000).state;assert.ok(s.education!.enrolments[enrolmentId].certificate);
 const scoped=citizenView(s,owner,now).education!;assert.ok(scoped.enrolments.every(e=>e.actor===owner));assert.equal(scoped.mentorships.length,1);reconcile(s);
});
function offeredPractice(){
 let s=setup();s=completeCourse(s,owner,'medicine',start+7*DAY);s=completeCourse(s,student,'secondary',start+5*DAY);
 const enrolled=run(s,student,'EnrollCourse',{courseId:'medicine',acceptedFee:200000,acceptTerms:true});s=enrolled.state;const enrolmentId=String(enrolled.receipt.detail.enrolmentId),course=COURSES.find(c=>c.id==='medicine')!;
 const invitation=run(s,student,'InviteMentor',{enrolmentId,citizenId:s.citizens[owner].id});s=invitation.state;const mentorshipId=String(invitation.receipt.detail.mentorshipId);s=run(s,owner,'AcceptMentorship',{mentorshipId,consent:true}).state;
 for(const [i,task] of course.tasks.entries())s=run(s,student,'StudyCourse',{enrolmentId,choice:task.correct},now+(i+1)*2000).state;s=run(s,student,'TakeCourseExam',{enrolmentId,answers:course.exam.map(q=>q.correct)},now+60000).state;
 const offered=run(s,owner,'OfferMentoredPractice',{mentorshipId,choice:0},now+61000);return{state:offered.state,enrolmentId,mentorshipId,practiceSessionId:String(offered.receipt.detail.practiceSessionId)};
}
test('leaving, blocking and expiry revoke scoped progress and offered practice while NPC teaching survives',()=>{
 for(const action of ['leave','block','expire']){
  let {state:s,enrolmentId,mentorshipId,practiceSessionId}=offeredPractice();const at=action==='expire'?now+7*DAY:now+62000;
  if(action==='leave')s=run(s,student,'LeaveMentorship',{mentorshipId},at).state;
  if(action==='block')s=run(s,student,'BlockCitizen',{citizenId:s.citizens[owner].id},at).state;
  const view=citizenView(s,owner,at).education!;assert.equal(view.mentorships[0].progress,null);assert.equal(view.mentorships[0].statusOfCourse,null);
  assert.throws(()=>run(s,student,'SupervisedPractice',{enrolmentId,practiceSessionId,choice:0},at),code('PRACTICE_SESSION_INVALID'));
  s=run(s,student,'SupervisedPractice',{enrolmentId,choice:0},at).state;assert.equal(s.education!.enrolments[enrolmentId].practice,1);
  if(action!=='expire'){assert.equal(s.education!.practiceSessions![practiceSessionId].status,'cancelled');assert.equal(s.education!.mentorships![mentorshipId].status,'ended');}
  reconcile(s);
 }
});
