import test from 'node:test';
import assert from 'node:assert/strict';
import {initialState,execute,citizenView,DAY,DomainError} from '../src/domain.ts';
import type {State} from '../src/domain.ts';
import {finishModules,graduate,examPayload} from './helpers.ts';
import {foundationExam,CURRICULUM_VERSION} from '../src/curriculum.ts';
import {COURSES,hasLicence} from '../src/education.ts';
let seq=0;const start=10*DAY,actor='student-one';
const apply=(s:State,type:string,payload:Record<string,unknown>={},now=start,who=actor)=>execute(s,who,{id:'edu_test_'+ ++seq,type,payload},now);
const create=()=>apply(initialState(),'CreateCitizen',{name:'Ada',state:'Lagos',adultConfirmed:true}).state;
const code=(value:string)=>(e:unknown)=>e instanceof DomainError&&e.code===value;
function course(s:State,id:string,now:number,scholarshipId?:string){
 const c=COURSES.find(x=>x.id===id)!,began=apply(s,'EnrollCourse',{courseId:id,acceptedFee:c.fee,acceptTerms:true,...(scholarshipId?{scholarshipId}:{})},now),enrolmentId=String(began.receipt.detail.enrolmentId);s=began.state;
 for(const [i,task] of c.tasks.entries())s=apply(s,'StudyCourse',{enrolmentId,choice:task.correct},now+(i+1)*2000).state;
 s=apply(s,'TakeCourseExam',{enrolmentId,answers:c.exam.map(q=>q.correct)},now+60000).state;
 for(let i=0;i<c.practice;i++)s=apply(s,'SupervisedPractice',{enrolmentId,choice:0},now+120000+i*60000).state;
 return{s,enrolmentId};
}
test('foundation requires real practical records and issues one versioned randomized certificate',()=>{
 let s=create();assert.throws(()=>apply(s,'CompleteLesson',{day:1}),code('PRACTICAL_REQUIRED'));s=finishModules(s,actor,start);const exam=foundationExam(s,actor);
 assert.equal(exam.questions.length,20);for(let day=1;day<=5;day++)assert.equal(exam.questions.filter(q=>q.day===day).length,4);
 assert.ok(citizenView(s,actor,start+4*DAY).exam.every(q=>!('correct' in q)));const before=exam.id;s=apply(s,'SubmitExam',examPayload(s,actor,false),start+4*DAY).state;
 assert.notEqual(foundationExam(s,actor).id,before);s=apply(s,'CompleteLesson',{day:5},start+4*DAY).state;assert.throws(()=>apply(s,'SubmitExam',{...examPayload(s,actor),examId:before},start+4*DAY),code('EXAM_CHANGED'));
 s=apply(s,'SubmitExam',examPayload(s,actor),start+4*DAY).state;assert.equal(s.citizens[actor].certificate?.curriculumVersion,CURRICULUM_VERSION);
});
test('funded study enforces prerequisite, examination and supervised practice before licence',()=>{
 let s=create();assert.throws(()=>apply(s,'EnrollCourse',{courseId:'medicine',acceptedFee:200000,acceptTerms:true}),code('FOUNDATION_REQUIRED'));s=graduate(s,actor,start);const now=start+5*DAY;
 assert.throws(()=>apply(s,'EnrollCourse',{courseId:'medicine',acceptedFee:200000,acceptTerms:true},now),code('COURSE_PREREQUISITE'));
 s=course(s,'secondary',now).s;let result=course(s,'medicine',now+DAY);s=result.s;assert.equal(hasLicence(s,actor,'medicine',now+DAY+240000),false);
 s=apply(s,'IssueLicence',{enrolmentId:result.enrolmentId},now+DAY+240000).state;assert.equal(hasLicence(s,actor,'medicine',now+DAY+240000),true);assert.equal(hasLicence(s,actor,'medicine',now+32*DAY),false);
 assert.throws(()=>apply(s,'IssueLicence',{enrolmentId:result.enrolmentId},now+DAY+240001),code('ALREADY_LICENSED'));
 const licence=Object.values(s.education!.licences)[0],renewAt=licence.expiresAt;s=apply(s,'RenewLicence',{licenceId:licence.id,choice:0,acceptedFee:10000},renewAt).state;assert.equal(hasLicence(s,actor,'medicine',renewAt),true);
});
test('restricted scholarships cannot fund a different citizen or become cash on cancellation',()=>{
 let s=create();s=apply(s,'CreateCitizen',{name:'Donor',state:'Ogun',adultConfirmed:true},start,'donor-one').state;s=graduate(s,actor,start);const now=start+5*DAY;
 const offer=apply(s,'OfferScholarship',{citizenId:s.citizens[actor].id,courseId:'secondary',acceptedFee:50000},now,'donor-one');s=offer.state;const award=String(offer.receipt.detail.scholarshipId),balance=s.balances['citizen:'+actor];
 assert.throws(()=>apply(s,'EnrollCourse',{courseId:'secondary',acceptedFee:50000,acceptTerms:true,scholarshipId:award},now,'donor-one'),code('FOUNDATION_REQUIRED'));
 const enrolled=apply(s,'EnrollCourse',{courseId:'secondary',acceptedFee:50000,acceptTerms:true,scholarshipId:award},now);s=enrolled.state;s=apply(s,'CancelCourse',{enrolmentId:enrolled.receipt.detail.enrolmentId},now+1000).state;
 assert.equal(s.balances['citizen:'+actor],balance);assert.equal(s.balances['scholarship:'+award],50000);assert.equal(s.education!.scholarships[award].status,'offered');assert.throws(()=>apply(s,'RefundScholarship',{scholarshipId:award},now+DAY,'donor-one'),code('AWARD_COMMITTED'));
 s=apply(s,'RefundScholarship',{scholarshipId:award},now+30*DAY,'donor-one').state;assert.equal(s.balances['scholarship:'+award],0);
});
