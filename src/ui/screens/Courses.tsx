import { useState, type CSSProperties } from 'react';
import { useGame, DAY_HARD_END } from '../../game/store';
import {
  COURSE_NAMES,
  COURSE_ORDER,
  COURSES,
  EMPLOYEE_XP_MULT,
  employeeCourseBlocker,
  playerCourseBlocker,
  skillOfRole,
  type Course,
} from '../../game/training';
import { ROLES } from '../../game/team';
import type { Employee, SkillId } from '../../game/types';
import { Button } from '../components/Button';
import { Tabs } from '../components/Tabs';
import { Avatar } from '../components/Avatar';
import { money } from '../components/AnimatedNumber';

const SKILL_HUE: Record<SkillId, string> = { sales: 'var(--c-phone)', design: 'var(--c-skills)', development: 'var(--c-projects)' };
const SKILL_NAME: Record<SkillId, string> = { sales: 'Sales', design: 'Design', development: 'Development' };

function CourseRow({
  skill,
  course,
  xpMult,
  blocker,
  onTake,
  action,
}: {
  skill: SkillId;
  course: Course;
  xpMult: number;
  blocker: string | null;
  onTake: () => void;
  action: string;
}) {
  const info = COURSE_NAMES[skill][course.id];
  return (
    <div className="course-row">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{info.name}</div>
        <p className="small muted">{info.blurb}</p>
        <div className="chip-list">
          <span className="badge">{course.hours} hrs</span>
          <span className="badge">{money(course.cost)}</span>
          <span className="badge accent">+{course.xp * xpMult} XP</span>
        </div>
      </div>
      <Button size="sm" variant={blocker ? 'default' : 'primary'} disabled={!!blocker} onClick={onTake}>
        {blocker ?? action}
      </Button>
    </div>
  );
}

function YourCourses() {
  const { skills, money: cash, minute, day, lastCourseDay, activeCall, takeCourse } = useGame();
  const onCall = !!activeCall && activeCall.phase !== 'ended';
  const tookOne = lastCourseDay === day;
  return (
    <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
      {(['sales', 'design', 'development'] as SkillId[]).map((skill) => (
        <div key={skill} className="card stack skill-card" style={{ gap: 12, '--hue': SKILL_HUE[skill] } as CSSProperties}>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <h3>{SKILL_NAME[skill]}</h3>
            <span className="badge accent">Level {skills[skill].level}</span>
          </div>
          {COURSE_ORDER.map((id) => {
            const course = COURSES[id];
            const blocker = onCall ? 'On a call' : playerCourseBlocker(course, skills[skill].level, cash, minute, DAY_HARD_END, tookOne);
            return <CourseRow key={id} skill={skill} course={course} xpMult={1} blocker={blocker} action="Take it" onTake={() => takeCourse(skill, id)} />;
          })}
        </div>
      ))}
    </div>
  );
}

function TeamMember({ e }: { e: Employee }) {
  const { money: cash, trainEmployee } = useGame();
  const skill = skillOfRole(e.role);
  return (
    <div className="card stack skill-card" style={{ gap: 12, '--hue': SKILL_HUE[skill] } as CSSProperties}>
      <div className="row" style={{ gap: 10 }}>
        <Avatar name={e.name} text={e.name[0]} size={34} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3>{e.name}</h3>
          <p className="small muted">
            {ROLES[e.role].label} &middot; level {e.level}
          </p>
        </div>
      </div>
      {e.training && (
        <p className="small" style={{ color: 'var(--good)' }}>
          In training: {COURSE_NAMES[skill][e.training.course].name}. {e.training.hoursLeft} working hour{e.training.hoursLeft === 1 ? '' : 's'} left.
        </p>
      )}
      {COURSE_ORDER.map((id) => {
        const course = COURSES[id];
        return (
          <CourseRow
            key={id}
            skill={skill}
            course={course}
            xpMult={EMPLOYEE_XP_MULT}
            blocker={employeeCourseBlocker(course, e.level, !!e.training, cash)}
            action="Send"
            onTake={() => trainEmployee(e.id, id)}
          />
        );
      })}
    </div>
  );
}

/** Pay for courses to level up faster, for you or for your team. */
export function Courses() {
  const employees = useGame((s) => s.employees);
  const [tab, setTab] = useState<'you' | 'team'>('you');
  return (
    <div className="stack" style={{ gap: 14 }}>
      <div className="row wrap" style={{ justifyContent: 'space-between' }}>
        <div style={{ flex: '1 1 280px' }}>
          <h2>Courses</h2>
          <p className="small muted" style={{ marginTop: 4 }}>
            {tab === 'you'
              ? 'Pay to learn faster than you would by working. One course a day, and it uses up part of your day.'
              : 'Someone on a course doesn’t work until it’s over, then comes back sharper. They learn twice as much as you would.'}
          </p>
        </div>
        <Tabs
          id="courses"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'you', label: 'For you' },
            { value: 'team', label: `Your team (${employees.length})` },
          ]}
        />
      </div>
      {tab === 'you' ? (
        <YourCourses />
      ) : employees.length === 0 ? (
        <div className="card empty">Hire someone first, then you can send them on courses.</div>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))' }}>
          {employees.map((e) => (
            <TeamMember key={e.id} e={e} />
          ))}
        </div>
      )}
    </div>
  );
}
