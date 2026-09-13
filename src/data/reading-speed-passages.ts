/**
 * Static content bank for the reading speed test (src/app/reading-speed-test).
 * Hand-written, not empirically calibrated/piloted — see the feature's design
 * notes. Each passage is ~180 words of general nonfiction (no proper nouns,
 * dates, or numbers where avoidable) with 5 comprehension questions:
 * main idea, two explicit-information, and two inference questions.
 *
 * correctIndex/type are server-only — never send a raw passage object to the
 * client; use service.ts's sanitizePassage().
 */

export type ReadingSpeedQuestionType = 'main_idea' | 'explicit' | 'inference';

export interface ReadingSpeedQuestion {
  id: string;
  type: ReadingSpeedQuestionType;
  question: string;
  options: string[];
  correctIndex: number;
}

export interface ReadingSpeedPassage {
  id: string;
  title: string;
  body: string;
  questions: ReadingSpeedQuestion[];
}

export const READING_SPEED_PASSAGES: ReadingSpeedPassage[] = [
  {
    id: 'coral-reefs',
    title: 'How Coral Reefs Build Themselves',
    body: `Coral reefs look like solid rock, but they are built by tiny soft-bodied animals called polyps. Each polyp is barely larger than a grain of rice, yet it can pull minerals from seawater and turn them into a hard, cup-shaped shelter. A reef forms when millions of these shelters are cemented together over many generations, with new polyps growing on the skeletons the old ones left behind.

Polyps rarely work alone. Most species host colonies of algae inside their tissue, and this partnership is what makes reef-building possible at all. The algae use sunlight to produce food, sharing the surplus with their polyp host, while the polyp offers a safe, well-lit home in return. Without this exchange, polyps could not gather enough energy to build their mineral skeletons quickly enough to form a reef.

This partnership is also the reef's greatest weakness. When water grows too warm, the algae produce compounds that harm the polyp, and the coral expels them to survive, leaving behind a pale, "bleached" skeleton. A bleached reef is not automatically dead, but it is starving, and if warm water persists for too long, the polyps beneath it will not recover.`,
    questions: [
      {
        id: 'q1', type: 'main_idea',
        question: 'What is this passage mainly about?',
        options: [
          'How ocean currents shape the physical structure of reefs',
          'How a partnership between polyps and algae builds and threatens reefs',
          'Why coral reefs are the largest structures built by animals',
          'How scientists measure the health of a bleached reef',
        ],
        correctIndex: 1,
      },
      {
        id: 'q2', type: 'explicit',
        question: 'According to the passage, what does a polyp actually build its shelter from?',
        options: ['Minerals pulled from seawater', 'Leftover algae tissue', 'Sand carried by currents', 'Compounds released during bleaching'],
        correctIndex: 0,
      },
      {
        id: 'q3', type: 'explicit',
        question: 'What does the algae provide to the polyp, according to the passage?',
        options: ['A hard mineral skeleton', 'Food produced from sunlight', 'Protection from warm water', 'A new colony to join'],
        correctIndex: 1,
      },
      {
        id: 'q4', type: 'inference',
        question: 'Based on the passage, why would a polyp struggle to build a reef without its algae partner?',
        options: [
          'It would lack enough energy to build its skeleton fast enough',
          'It would be unable to survive in seawater at all',
          'It would grow too large to cement with other polyps',
          "It would attract predators without the algae's camouflage",
        ],
        correctIndex: 0,
      },
      {
        id: 'q5', type: 'inference',
        question: 'What can be concluded about a "bleached" reef from the passage?',
        options: [
          'It has already died and cannot be restored',
          'It has lost its algae and is now going hungry',
          'It has begun forming a brand-new skeleton',
          'It has been abandoned by its polyps entirely',
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    id: 'multitasking',
    title: 'The Hidden Cost of Multitasking',
    body: `Most people believe they can answer a message while finishing a report without losing much time. In reality, the brain does not process two demanding tasks at once. It switches rapidly between them, and each switch carries a small delay while the relevant information is reloaded into working memory.

These delays feel invisible because they last only a fraction of a second, but they add up quickly across a busy day. Research on task-switching consistently finds that people take longer to finish two interleaved tasks than they would take to finish the same two tasks one after another. The more similar the tasks are, the worse this cost tends to be, because similar tasks compete for the same mental resources instead of using separate ones.

The deeper problem is that switching also drains the quality of attention left for whichever task resumes. A person who checks a notification mid-sentence does not simply lose the few seconds spent reading it; they also spend extra time reorienting to where their original thought had been heading. Treating attention as something that can be split evenly between tasks misunderstands how it actually works.`,
    questions: [
      {
        id: 'q1', type: 'main_idea',
        question: 'What is the main point of this passage?',
        options: [
          'Multitasking creates hidden delays and reduces the quality of attention',
          'Notifications should be disabled to improve focus',
          'Some tasks are naturally easier to combine than others',
          'Working memory can hold multiple tasks without cost',
        ],
        correctIndex: 0,
      },
      {
        id: 'q2', type: 'explicit',
        question: 'According to the passage, what happens when the brain "switches" between two tasks?',
        options: [
          'It carries a small delay while information is reloaded into memory',
          "It permanently loses part of the original task's information",
          'It shuts down one task completely before starting the other',
          'It slows down only when the tasks are unrelated',
        ],
        correctIndex: 0,
      },
      {
        id: 'q3', type: 'explicit',
        question: 'Based on the passage, when is the switching cost worse?',
        options: [
          'When the two tasks are very different from each other',
          'When the two tasks are similar and compete for the same resources',
          'When only one task requires attention',
          'When a task is interrupted more than twice',
        ],
        correctIndex: 1,
      },
      {
        id: 'q4', type: 'inference',
        question: 'What can be inferred about someone who checks a notification mid-sentence?',
        options: [
          'They lose only the exact time spent reading the notification',
          'They lose additional time reorienting to their original thought afterward',
          'They finish their sentence faster because of the short break',
          'They avoid any switching cost because the interruption was brief',
        ],
        correctIndex: 1,
      },
      {
        id: 'q5', type: 'inference',
        question: 'What misunderstanding does the passage say people have about attention?',
        options: [
          'That switching between tasks has no real mental cost',
          'That attention improves the more it is divided',
          'That similar tasks are always harder to combine',
          'That working memory cannot hold any information at all',
        ],
        correctIndex: 0,
      },
    ],
  },
  {
    id: 'bridges-sway',
    title: 'Why Bridges Sway',
    body: `Every bridge moves. Even structures that look perfectly rigid flex slightly under the weight of traffic, the push of wind, and the gentle vibration of their own materials settling into place. Engineers do not try to eliminate this movement entirely; instead, they design a bridge to sway within limits it can safely absorb, then dissipate that energy before it grows dangerous.

Problems appear when a bridge's natural sway lines up with an outside rhythm, such as wind gusts or the shared footsteps of a crowd. When this happens, small movements begin reinforcing each other instead of canceling out, and the bridge can start swinging with far more force than any single push would explain. This effect, known as resonance, is why soldiers are traditionally told to break step when crossing a bridge, even though a single soldier's stride would never trouble the structure.

Modern designs manage this risk with dampers: heavy counterweights or fluid-filled cylinders that absorb the bridge's energy and convert it into a small amount of heat. A well-tuned damper does not stop a bridge from moving; it simply prevents that movement from building on itself, keeping the sway well inside the range the structure was built to tolerate.`,
    questions: [
      {
        id: 'q1', type: 'main_idea',
        question: 'What is this passage mainly about?',
        options: [
          'Why bridges are designed to sway and how that sway is kept safe',
          'How soldiers should march across historic bridges',
          'The materials that make modern bridges stronger than older ones',
          'Why wind is the most dangerous force acting on a bridge',
        ],
        correctIndex: 0,
      },
      {
        id: 'q2', type: 'explicit',
        question: "According to the passage, what do engineers try to do with a bridge's movement?",
        options: [
          'Eliminate it completely through rigid materials',
          'Let it sway within limits and dissipate the energy safely',
          "Redirect it entirely into the bridge's foundations",
          'Ignore it unless a crowd is present',
        ],
        correctIndex: 1,
      },
      {
        id: 'q3', type: 'explicit',
        question: 'What does a damper do, according to the passage?',
        options: [
          'It stops the bridge from moving under any load',
          'It absorbs energy and converts it into a small amount of heat',
          'It cancels out wind before it reaches the bridge',
          "It increases the bridge's natural sway for safety testing",
        ],
        correctIndex: 1,
      },
      {
        id: 'q4', type: 'inference',
        question: 'Why are soldiers traditionally told to break step on a bridge?',
        options: [
          "A single soldier's stride is dangerous on its own",
          "Marching in step could align with the bridge's natural sway and reinforce it",
          "Breaking step tests the bridge's dampers",
          'Soldiers marching in step move too slowly across long bridges',
        ],
        correctIndex: 1,
      },
      {
        id: 'q5', type: 'inference',
        question: 'What does the passage suggest about a bridge that never moves at all?',
        options: [
          'It is the safest possible design',
          'It is likely relying on dampers instead of flexible materials',
          'That is not how real bridges are actually built to behave',
          'It would only be true for very short bridges',
        ],
        correctIndex: 2,
      },
    ],
  },
  {
    id: 'boredom',
    title: 'The Science of Boredom',
    body: `Boredom is often treated as an empty feeling, a sign that nothing is happening in the mind. Researchers who study it disagree. They describe boredom as a signal, similar to hunger or thirst, that tells a person their current activity is not offering enough mental engagement and that it may be time to look for something else.

This view helps explain why boredom feels different from simply being calm or at rest. A resting mind is content with low stimulation, but a bored mind is uncomfortable with it, and that discomfort is what pushes people to switch tasks, seek novelty, or in some cases reach for a distraction like a phone. The feeling is unpleasant on purpose, because a signal that was easy to ignore would not be very useful.

This is also why constant distraction can be a problem. If every idle moment is immediately filled with a notification or a video, the signal never gets a chance to do its job. Some researchers argue that boredom, left alone for a few minutes, is what nudges people toward creative thinking or new ideas, leading them to look inward rather than back at the same task.`,
    questions: [
      {
        id: 'q1', type: 'main_idea',
        question: 'What is the main idea of this passage?',
        options: [
          'Boredom is a useless mental state that should be eliminated',
          'Boredom acts as a signal pushing people to change activity, and can prompt creativity',
          'Boredom and rest are essentially the same experience',
          'Phones are the main cause of boredom in modern life',
        ],
        correctIndex: 1,
      },
      {
        id: 'q2', type: 'explicit',
        question: 'According to the passage, what do researchers compare boredom to?',
        options: ['Hunger or thirst', 'Sleepiness', 'Anxiety', 'Curiosity'],
        correctIndex: 0,
      },
      {
        id: 'q3', type: 'explicit',
        question: 'According to the passage, what makes a resting mind different from a bored mind?',
        options: [
          'A resting mind is content with low stimulation, a bored mind is not',
          'A resting mind seeks distraction more often',
          'A resting mind cannot experience discomfort',
          'A resting mind is only possible after boredom passes',
        ],
        correctIndex: 0,
      },
      {
        id: 'q4', type: 'inference',
        question: 'Why does the passage suggest boredom feels unpleasant on purpose?',
        options: [
          'Because pleasant signals are ignored too easily to be useful',
          'Because researchers have not found a way to make it comfortable',
          'Because discomfort is required for creative thinking to occur',
          'Because boredom only appears after long periods of rest',
        ],
        correctIndex: 0,
      },
      {
        id: 'q5', type: 'inference',
        question: 'What might the passage suggest about constantly filling idle moments with notifications?',
        options: [
          'It has no real effect on how people think',
          'It may prevent boredom from prompting new ideas',
          "It strengthens boredom's usefulness as a signal",
          'It replaces the need for rest entirely',
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    id: 'bee-swarm',
    title: 'How Bees Choose a New Home',
    body: `When a honeybee colony outgrows its hive, roughly half the bees leave together in a swarm to search for a new home, while a queen stays behind with the rest. The traveling swarm gathers on a nearby branch and waits there, sometimes for days, while a small group of scout bees fans out to inspect possible sites.

Each scout that finds a promising cavity returns and performs a dance that encodes its direction, distance, and rough quality. Other scouts watch this dance, and some are persuaded to fly out and inspect the same site themselves. If they agree it is a good option, they return and repeat the dance, gradually recruiting more scouts to that one site over the others being advertised at the same time.

The swarm does not choose a home by majority vote in a single moment. Instead, support for the best site keeps building until it crosses a threshold, at which point the scouts advocating for it begin a distinct signal that tells the resting swarm it is time to fly. This slow, self-reinforcing process usually settles on one of the strongest candidates, even though no single bee ever compares all the options directly.`,
    questions: [
      {
        id: 'q1', type: 'main_idea',
        question: 'What is this passage mainly about?',
        options: [
          'How a swarm of bees gradually reaches agreement on a new home',
          'Why bees abandon a hive once it becomes too crowded',
          'How a queen bee selects scouts for a swarm',
          'The different dances bees use to warn of danger',
        ],
        correctIndex: 0,
      },
      {
        id: 'q2', type: 'explicit',
        question: "According to the passage, what does a scout's dance encode?",
        options: [
          'Direction, distance, and rough quality of a site',
          'The exact number of bees needed to move',
          'The age of the queen bee',
          'How long the swarm has been waiting',
        ],
        correctIndex: 0,
      },
      {
        id: 'q3', type: 'explicit',
        question: 'According to the passage, what happens once support for one site crosses a threshold?',
        options: [
          'The queen personally inspects the site',
          'Scouts advocating for it begin a signal telling the swarm to fly',
          'The swarm splits into two smaller groups',
          'All remaining scouts stop dancing immediately',
        ],
        correctIndex: 1,
      },
      {
        id: 'q4', type: 'inference',
        question: 'What can be inferred about a scout who watches another\'s dance and is "persuaded"?',
        options: [
          'It immediately accepts the site without checking it',
          'It flies out to inspect that same site itself',
          'It stops dancing for its own preferred site permanently',
          'It reports back to the queen directly',
        ],
        correctIndex: 1,
      },
      {
        id: 'q5', type: 'inference',
        question: "What does the passage suggest about how the swarm reaches its final decision?",
        options: [
          'A single bee ultimately compares every option and decides',
          "The decision emerges gradually from many scouts' cumulative signals",
          'The queen makes the final choice once scouts return',
          'The decision is essentially random among equally good sites',
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    id: 'photographic-memory',
    title: 'The Myth of Photographic Memory',
    body: `Photographic memory, the idea that someone can glance at a page and recall it perfectly later, shows up constantly in movies and books. Despite decades of research, however, scientists have never confirmed a verified case of an adult with a true photographic memory under controlled testing conditions.

What does exist is something less magical but still impressive. Some people develop exceptional memory through years of deliberate practice, building elaborate mental systems that link new information to images or locations they already know well. These techniques can produce startling feats, such as memorizing long sequences of digits or entire decks of cards, but they rely on effortful strategy rather than an effortless snapshot of a page.

A smaller number of people have highly detailed autobiographical memory, recalling personal events from years earlier in unusual detail. Even this ability is selective: it applies mainly to memories of their own lives, not to arbitrary text or images shown once. The gap between this real phenomenon and the popular idea of photographic memory is large, and conflating the two has made it harder for people to appreciate what trained memory can actually achieve.`,
    questions: [
      {
        id: 'q1', type: 'main_idea',
        question: 'What is the main idea of this passage?',
        options: [
          'True photographic memory is common but rarely discussed in research',
          'True photographic memory is unconfirmed, but trained and selective memory abilities are real',
          'Memorizing cards and digits proves that photographic memory exists',
          'Autobiographical memory is identical to photographic memory',
        ],
        correctIndex: 1,
      },
      {
        id: 'q2', type: 'explicit',
        question: 'According to the passage, what have scientists never confirmed?',
        options: [
          'A verified case of true photographic memory in an adult',
          'A verified case of autobiographical memory',
          'A verified method for memorizing card decks',
          'A verified link between practice and memory loss',
        ],
        correctIndex: 0,
      },
      {
        id: 'q3', type: 'explicit',
        question: 'According to the passage, what do people with exceptional trained memory rely on?',
        options: [
          'An effortless snapshot of a page',
          'Elaborate mental systems linking information to familiar images or locations',
          'A rare genetic condition',
          'Repeated exposure to the same page over years',
        ],
        correctIndex: 1,
      },
      {
        id: 'q4', type: 'inference',
        question: 'What can be inferred about someone with highly detailed autobiographical memory?',
        options: [
          'They can recall arbitrary text shown to them once',
          "Their unusual recall mainly applies to their own life's events",
          'They also have confirmed photographic memory',
          'They cannot recall anything from more than a year ago',
        ],
        correctIndex: 1,
      },
      {
        id: 'q5', type: 'inference',
        question: 'According to the passage, what problem does confusing real memory abilities with "photographic memory" cause?',
        options: [
          'It makes trained memory techniques impossible to learn',
          'It makes it harder to appreciate what trained memory can actually achieve',
          'It proves that autobiographical memory does not exist',
          'It causes scientists to stop researching memory altogether',
        ],
        correctIndex: 1,
      },
    ],
  },
];
