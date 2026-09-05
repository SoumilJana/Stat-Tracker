CREATE OR REPLACE FUNCTION get_player_stats_in_range(p_start_date TIMESTAMP WITH TIME ZONE, p_end_date TIMESTAMP WITH TIME ZONE)
RETURNS TABLE (
    player_id UUID,
    matches_played BIGINT,
    goals BIGINT,
    assists BIGINT,
    wins BIGINT,
    losses BIGINT,
    draws BIGINT,
    best_defender_awards BIGINT,
    best_gk_awards BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH valid_sessions AS (
        SELECT s.id, s.mode
        FROM sessions s
        WHERE s.status = 'COMPLETED'
        AND s.date >= p_start_date
        AND (p_end_date IS NULL OR s.date < p_end_date)
    ),
    team_stats AS (
        SELECT
            sts.session_id,
            sts.team_id,
            sts.score,
            CASE
                WHEN vs.mode = 'WINNER_STAYS' THEN
                    sts.score = (SELECT MAX(s2.score) FROM session_team_stats s2 WHERE s2.session_id = sts.session_id)
                ELSE
                    sts.score > (SELECT MAX(s2.score) FROM session_team_stats s2 WHERE s2.session_id = sts.session_id AND s2.team_id != sts.team_id)
            END as is_winner,
            CASE
                WHEN vs.mode = 'STANDARD' AND sts.score = (SELECT MAX(s2.score) FROM session_team_stats s2 WHERE s2.session_id = sts.session_id AND s2.team_id != sts.team_id) THEN true
                ELSE false
            END as is_draw
        FROM session_team_stats sts
        JOIN valid_sessions vs ON vs.id = sts.session_id
    ),
    session_players AS (
        SELECT 
            st.session_id,
            st.id as team_id,
            jsonb_array_elements_text(st.player_ids)::uuid as player_id
        FROM session_teams st
        JOIN valid_sessions vs ON vs.id = st.session_id
    ),
    -- Awards: count only winning votes (rank=1) in valid sessions
    session_award_winners AS (
        WITH ranked AS (
            SELECT
                pv.session_id,
                pv.award_type,
                pv.candidate_id,
                COUNT(*) as votes,
                ROW_NUMBER() OVER (PARTITION BY pv.session_id, pv.award_type ORDER BY COUNT(*) DESC, pv.candidate_id ASC) as rank
            FROM poll_votes pv
            JOIN valid_sessions vs ON vs.id = pv.session_id
            GROUP BY pv.session_id, pv.award_type, pv.candidate_id
        )
        SELECT session_id, award_type, candidate_id
        FROM ranked
        WHERE rank = 1
    ),
    award_counts AS (
        SELECT
            candidate_id as player_id,
            SUM(CASE WHEN award_type = 'BEST_DEFENDER' THEN 1 ELSE 0 END) as best_defender_awards,
            SUM(CASE WHEN award_type = 'BEST_GK' THEN 1 ELSE 0 END) as best_gk_awards
        FROM session_award_winners
        GROUP BY candidate_id
    )
    SELECT
        sp.player_id,
        COUNT(DISTINCT sp.session_id)::BIGINT as matches_played,
        SUM(CASE WHEN e.type = 'GOAL' THEN 1 ELSE 0 END)::BIGINT as goals,
        SUM(CASE WHEN e.type = 'ASSIST' THEN 1 ELSE 0 END)::BIGINT as assists,
        SUM(CASE WHEN ts.is_winner THEN 1 ELSE 0 END)::BIGINT as wins,
        SUM(CASE WHEN NOT ts.is_winner AND NOT ts.is_draw THEN 1 ELSE 0 END)::BIGINT as losses,
        SUM(CASE WHEN ts.is_draw THEN 1 ELSE 0 END)::BIGINT as draws,
        COALESCE(MAX(ac.best_defender_awards), 0)::BIGINT as best_defender_awards,
        COALESCE(MAX(ac.best_gk_awards), 0)::BIGINT as best_gk_awards
    FROM session_players sp
    LEFT JOIN team_stats ts ON ts.session_id = sp.session_id AND ts.team_id = sp.team_id
    LEFT JOIN events e ON e.session_id = sp.session_id AND e.player_id = sp.player_id
    LEFT JOIN award_counts ac ON ac.player_id = sp.player_id
    GROUP BY sp.player_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
