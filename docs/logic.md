The "1 AM Streak Reset" (Global Logic):

    The system does not reset at midnight.

    Study_Date = (Current_Time < 01:00 AM) ? Yesterday : Today.

    This ensures the "Midnight Student" never loses a streak while working.

2. The 3-Step State Machine (Lesson Logic):

    State 0 (Concept): Show Main Question + Concept MCQ.

    State 1 (Formula): Collapse Step 0

            
    →
    →

          

    Show Formula MCQ.

    State 2 (Calculation): Collapse Step 1

            
    →
    →

          

    Show Result MCQ.

    Transition: Each "Continue" click must trigger a vertical "Accordion" animation, pushing the previous step up and unfolding the next.

3. The Loss Aversion (Streak Fixer):

    If a user misses a day, show a "Revive" screen on the next login.

    Cost: 50 Knowledge Coins to "Buy Back" the streak.

