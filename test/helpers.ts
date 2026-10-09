import { execute } from '../src/domain.ts';
import type { State,Command } from '../src/domain.ts';
import { STARTER_JOBS,STEP_INTERVAL } from '../src/jobs.ts';
import {streetWalkable} from '../src/neighbourhood.ts';
import {PRACTICALS,COURSES} from '../src/education.ts';
import {DAY} from '../src/domain.ts';
import {foundationExam} from '../src/curriculum.ts';
let sequence=0;
const cmd=(type:string,payload:Record<string,unknown>={}):Command=>({id:'test_work_'+ ++sequence,type,payload});
export function prepareWork(state:State,actor:string,start:number,jobId='cleaner'){
  state=execute(state,actor,cmd('BeginWork',{jobId}),start).state;
  const id=state.life!.work!.active[actor],job=STARTER_JOBS.find(j=>j.id===jobId)!;
  for(const [i,task] of job.tasks.entries())state=execute(state,actor,cmd('WorkStep',{shiftId:id,choice:task.correct}),start+(i+1)*STEP_INTERVAL).state;
  return state;
}
export async function prepareStoredWork(store:{dispatch:(actor:string,command:Command,now:number)=>Promise<unknown>},actor:string,start:number,jobId='cleaner'){
  await store.dispatch(actor,cmd('BeginWork',{jobId}),start);
  for(const [i,task] of STARTER_JOBS.find(j=>j.id===jobId)!.tasks.entries())await store.dispatch(actor,cmd('WorkStep',{choice:task.correct}),start+(i+1)*STEP_INTERVAL);
}
export function walkTo(state:State,actor:string,x:number,y:number,start:number){
 const pos=state.world!.positions[actor],queue:[number,number,[number,number][]][]=[[pos.x,pos.y,[]]],seen=new Set<string>();let path:[number,number][]=[];
 while(queue.length){const [cx,cy,steps]=queue.shift()!;if(cx===x&&cy===y){path=steps;break;}const key=cx+':'+cy;if(seen.has(key))continue;seen.add(key);for(const [dx,dy] of [[0,1],[0,-1],[1,0],[-1,0]]){const nx=cx+dx,ny=cy+dy;if(!streetWalkable(nx,ny))continue;queue.push([nx,ny,[...steps,[dx,dy]]]);}}
 for(const [i,[dx,dy]] of path.entries())state=execute(state,actor,cmd('MoveCitizen',{dx,dy}),start+(i+1)*250).state;return state;
}
export function firstDay(state:State,actor:string,start:number){
 state=walkTo(state,actor,4,7,start);state=execute(state,actor,cmd('EnterBuilding',{buildingId:'shelter'}),start+5000).state;state=execute(state,actor,cmd('ExitBuilding'),start+5001).state;
 state=execute(state,actor,cmd('BuyBasicMeal'),start+5002).state;state=prepareWork(state,actor,start+10000);return execute(state,actor,cmd('CompleteShift'),start+70000).state;
}
export function finishModules(state:State,actor:string,start:number){
 state=firstDay(state,actor,start);state=execute(state,actor,cmd('ChooseGoal',{goal:'ordinary'}),start+70000).state;
 for(let day=1;day<=5;day++){
  const time=start+(day-1)*DAY+(day===1?70000:0);
  if(day===2)state=execute(state,actor,cmd('SetPrivacy',{dm:false,location:false,presence:false}),time).state;
  for(const task of PRACTICALS[day-1])state=execute(state,actor,cmd('FoundationPractice',{day,choice:task.correct}),time).state;
  state=execute(state,actor,cmd('CompleteLesson',{day}),time).state;
 }
 return state;
}
export function examPayload(state:State,actor:string,pass=true){const exam=foundationExam(state,actor);return{examId:exam.id,answers:exam.questions.map(q=>pass?q.correct:(q.correct+1)%4)};}
export function graduate(state:State,actor:string,start:number){state=finishModules(state,actor,start);return execute(state,actor,cmd('SubmitExam',examPayload(state,actor)),start+4*DAY).state;}
export function completeCourse(state:State,actor:string,courseId:string,start:number){
 const course=COURSES.find(c=>c.id===courseId)!,enrolled=execute(state,actor,cmd('EnrollCourse',{courseId,acceptedFee:course.fee,acceptTerms:true}),start);state=enrolled.state;const enrolmentId=enrolled.receipt.detail.enrolmentId;
 for(const [i,task] of course.tasks.entries())state=execute(state,actor,cmd('StudyCourse',{enrolmentId,choice:task.correct}),start+(i+1)*2000).state;
 state=execute(state,actor,cmd('TakeCourseExam',{enrolmentId,answers:course.exam.map(q=>q.correct)}),start+60000).state;
 for(let i=0;i<course.practice;i++)state=execute(state,actor,cmd('SupervisedPractice',{enrolmentId,choice:0}),start+120000+i*60000).state;
 if(course.licence)state=execute(state,actor,cmd('IssueLicence',{enrolmentId}),start+120000+course.practice*60000).state;return state;
}
export async function completeStoredCourse(store:{dispatch:(actor:string,command:Command,now:number)=>Promise<{receipt:{detail:Record<string,unknown>}}>},actor:string,courseId:string,start:number){
 const course=COURSES.find(c=>c.id===courseId)!,enrolled=await store.dispatch(actor,cmd('EnrollCourse',{courseId,acceptedFee:course.fee,acceptTerms:true}),start),enrolmentId=enrolled.receipt.detail.enrolmentId;
 for(const [i,task] of course.tasks.entries())await store.dispatch(actor,cmd('StudyCourse',{enrolmentId,choice:task.correct}),start+(i+1)*2000);
 await store.dispatch(actor,cmd('TakeCourseExam',{enrolmentId,answers:course.exam.map(q=>q.correct)}),start+60000);
 for(let i=0;i<course.practice;i++)await store.dispatch(actor,cmd('SupervisedPractice',{enrolmentId,choice:0}),start+120000+i*60000);
 if(course.licence)await store.dispatch(actor,cmd('IssueLicence',{enrolmentId}),start+120000+course.practice*60000);
}
