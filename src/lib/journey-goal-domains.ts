/** 6 lĩnh vực mục tiêu cá nhân hỏi khi bắt đầu hành trình 180 ngày (ngoài "Kỷ luật" — dùng riêng ô giờ thức dậy).
 * Mỗi lĩnh vực có sẵn nhiều lựa chọn (tick, không gõ tay, chọn được nhiều) — mỗi lựa chọn gắn nhịp độ:
 *  - DAILY: khi chọn, tự tạo một Thói quen (Habit) lặp mỗi ngày — xuất hiện bắt buộc trong "Thói quen hôm nay"
 *    của Hành trình mỗi ngày, cho tới hết 180 ngày.
 *  - WEEKLY: khi chọn, trở thành một tiêu chí bắt buộc phải tick trong Weekly Challenge trước khi xác nhận
 *    hoàn thành tuần.
 *  - MONTHLY: khi chọn, trở thành một tiêu chí bắt buộc phải tick trong Monthly Challenge trước khi xác nhận
 *    hoàn thành tháng.
 * Dùng chung giữa form client (journey-commitment-form.tsx) và action server (actions/journey.ts). */
export type JourneyGoalCadence = "DAILY" | "WEEKLY" | "MONTHLY";

export type JourneyGoalOption = {
  id: string;
  label: string;
  cadence: JourneyGoalCadence;
};

export const JOURNEY_GOAL_DOMAINS = [
  {
    key: "health",
    label: "Sức khỏe",
    options: [
      { id: "health_exercise_4w", label: "Tập thể dục 4 buổi/tuần", cadence: "WEEKLY" },
      { id: "health_walk_daily", label: "Đi bộ 30 phút/ngày", cadence: "DAILY" },
      { id: "health_water_daily", label: "Uống đủ 2 lít nước/ngày", cadence: "DAILY" },
      { id: "health_sleep_daily", label: "Ngủ đủ 7-8 tiếng/ngày", cadence: "DAILY" },
      { id: "health_run_3w", label: "Chạy bộ 3km, 3 buổi/tuần", cadence: "WEEKLY" },
      { id: "health_stretch_daily", label: "Tập giãn cơ 15 phút/ngày", cadence: "DAILY" },
      { id: "health_eat_clean_daily", label: "Ăn uống lành mạnh", cadence: "DAILY" },
      { id: "health_no_fastfood_weekly", label: "Hạn chế đồ ăn nhanh", cadence: "WEEKLY" },
      { id: "health_no_phone_before_sleep", label: "Không dùng điện thoại trước khi ngủ 30 phút", cadence: "DAILY" },
      { id: "health_check_weight_weekly", label: "Kiểm tra cân nặng và thể trạng", cadence: "WEEKLY" },
      { id: "health_endurance_3w", label: "Tập luyện tăng sức bền, 3 buổi/tuần", cadence: "WEEKLY" },
      { id: "health_wake_early_daily", label: "Dậy sớm trước 6h30", cadence: "DAILY" },
    ],
  },
  {
    key: "knowledge",
    label: "Tri thức",
    options: [
      { id: "knowledge_read_daily", label: "Đọc 20 trang sách/ngày", cadence: "DAILY" },
      { id: "knowledge_lesson_weekly", label: "Học 1 bài học mới/tuần", cadence: "WEEKLY" },
      { id: "knowledge_read_major_daily", label: "Đọc sách chuyên ngành 30 phút/ngày", cadence: "DAILY" },
      { id: "knowledge_vocab_daily", label: "Học 10 từ vựng tiếng Anh/ngày", cadence: "DAILY" },
      { id: "knowledge_listening_daily", label: "Luyện nghe tiếng Anh 20 phút/ngày", cadence: "DAILY" },
      { id: "knowledge_video_daily", label: "Xem 1 video kiến thức hữu ích/ngày", cadence: "DAILY" },
      { id: "knowledge_notes_daily", label: "Ghi chú 3 điều đã học/ngày", cadence: "DAILY" },
      { id: "knowledge_summary_monthly", label: "Tóm tắt 1 cuốn sách/tháng", cadence: "MONTHLY" },
      { id: "knowledge_topic_monthly", label: "Học một chủ đề mới/tháng", cadence: "MONTHLY" },
      { id: "knowledge_practice_3w", label: "Thực hành kiến thức đã học, 3 buổi/tuần", cadence: "WEEKLY" },
      { id: "knowledge_journal_daily", label: "Viết nhật ký học tập/ngày", cadence: "DAILY" },
      { id: "knowledge_course_monthly", label: "Hoàn thành 1 khóa học online/tháng", cadence: "MONTHLY" },
    ],
  },
  {
    key: "career",
    label: "Sự nghiệp",
    options: [
      { id: "career_skill_daily", label: "Học kỹ năng mới 1 giờ/ngày", cadence: "DAILY" },
      { id: "career_goal_weekly", label: "Hoàn thành 1 mục tiêu công việc/tuần", cadence: "WEEKLY" },
      { id: "career_deepwork_daily", label: "Làm việc sâu (Deep Work) 2 giờ/ngày", cadence: "DAILY" },
      { id: "career_top3_daily", label: "Hoàn thành 3 công việc quan trọng nhất/ngày", cadence: "DAILY" },
      { id: "career_progress_daily", label: "Cập nhật tiến độ dự án/ngày", cadence: "DAILY" },
      { id: "career_portfolio_weekly", label: "Xây dựng portfolio cá nhân/tuần", cadence: "WEEKLY" },
      { id: "career_ai_tool_weekly", label: "Học công cụ AI mới/tuần", cadence: "WEEKLY" },
      { id: "career_market_weekly", label: "Nghiên cứu thị trường và đối thủ/tuần", cadence: "WEEKLY" },
      { id: "career_idea_weekly", label: "Phát triển một ý tưởng kinh doanh/tuần", cadence: "WEEKLY" },
      { id: "career_product_weekly", label: "Tạo ra 1 sản phẩm hoặc tài nguyên mới/tuần", cadence: "WEEKLY" },
      { id: "career_review_weekly", label: "Đánh giá hiệu suất công việc/tuần", cadence: "WEEKLY" },
      { id: "career_network_weekly", label: "Xây dựng mối quan hệ chuyên nghiệp/tuần", cadence: "WEEKLY" },
    ],
  },
  {
    key: "finance",
    label: "Tài chính",
    options: [
      { id: "finance_save_monthly", label: "Tiết kiệm 20% thu nhập/tháng", cadence: "MONTHLY" },
      { id: "finance_track_daily", label: "Ghi chép đầy đủ chi tiêu/ngày", cadence: "DAILY" },
      { id: "finance_no_impulse_weekly", label: "Không mua sắm ngoài kế hoạch/tuần", cadence: "WEEKLY" },
      { id: "finance_check_account_weekly", label: "Kiểm tra tài khoản tài chính/tuần", cadence: "WEEKLY" },
      { id: "finance_budget_monthly", label: "Lập ngân sách cá nhân/tháng", cadence: "MONTHLY" },
      { id: "finance_learn_daily", label: "Học kiến thức tài chính 20 phút/ngày", cadence: "DAILY" },
      { id: "finance_review_spend_weekly", label: "Đánh giá các khoản chi không cần thiết/tuần", cadence: "WEEKLY" },
      { id: "finance_income_source_monthly", label: "Tạo thêm một nguồn thu nhập/tháng", cadence: "MONTHLY" },
      { id: "finance_cashflow_weekly", label: "Theo dõi dòng tiền cá nhân/tuần", cadence: "WEEKLY" },
      { id: "finance_goal_monthly", label: "Đặt mục tiêu tiết kiệm cụ thể/tháng", cadence: "MONTHLY" },
      { id: "finance_investing_book_weekly", label: "Đọc sách về đầu tư và tài chính/tuần", cadence: "WEEKLY" },
      { id: "finance_summary_monthly", label: "Tổng kết tài chính cá nhân/tháng", cadence: "MONTHLY" },
    ],
  },
  {
    key: "mindset",
    label: "Tinh thần",
    options: [
      { id: "mindset_meditate_daily", label: "Thiền 10 phút/ngày", cadence: "DAILY" },
      { id: "mindset_gratitude_daily", label: "Viết điều biết ơn/ngày", cadence: "DAILY" },
      { id: "mindset_journal_daily", label: "Viết nhật ký cá nhân/ngày", cadence: "DAILY" },
      { id: "mindset_reflect_daily", label: "Dành 15 phút suy ngẫm/ngày", cadence: "DAILY" },
      { id: "mindset_no_complain_daily", label: "Không than phiền trong ngày", cadence: "DAILY" },
      { id: "mindset_limit_social_daily", label: "Hạn chế mạng xã hội/ngày", cadence: "DAILY" },
      { id: "mindset_offline_daily", label: "Dành 30 phút không sử dụng điện thoại/ngày", cadence: "DAILY" },
      { id: "mindset_quote_daily", label: "Đọc một câu nói truyền cảm hứng/ngày", cadence: "DAILY" },
      { id: "mindset_emotion_check_daily", label: "Tự đánh giá cảm xúc/ngày", cadence: "DAILY" },
      { id: "mindset_positive_thinking_daily", label: "Thực hành tư duy tích cực/ngày", cadence: "DAILY" },
      { id: "mindset_alone_time_weekly", label: "Dành thời gian ở một mình/tuần", cadence: "WEEKLY" },
      { id: "mindset_life_lesson_weekly", label: "Tổng kết bài học cuộc sống/tuần", cadence: "WEEKLY" },
    ],
  },
  {
    key: "relationships",
    label: "Quan hệ",
    options: [
      { id: "relationships_family_daily", label: "Dành thời gian cho gia đình/ngày", cadence: "DAILY" },
      { id: "relationships_call_weekly", label: "Gọi điện thăm người thân/tuần", cadence: "WEEKLY" },
      { id: "relationships_friends_weekly", label: "Chủ động hỏi thăm bạn bè/tuần", cadence: "WEEKLY" },
      { id: "relationships_dinner_daily", label: "Ăn tối cùng gia đình/ngày", cadence: "DAILY" },
      { id: "relationships_listen_daily", label: "Lắng nghe người khác tích cực/ngày", cadence: "DAILY" },
      { id: "relationships_thanks_daily", label: "Nói lời cảm ơn với người khác/ngày", cadence: "DAILY" },
      { id: "relationships_help_weekly", label: "Giúp đỡ một người/tuần", cadence: "WEEKLY" },
      { id: "relationships_meetup_monthly", label: "Gặp gỡ bạn bè thân thiết/tháng", cadence: "MONTHLY" },
      { id: "relationships_communication_weekly", label: "Học kỹ năng giao tiếp/tuần", cadence: "WEEKLY" },
      { id: "relationships_no_conflict_daily", label: "Hạn chế tranh luận tiêu cực/ngày", cadence: "DAILY" },
      { id: "relationships_quality_time_weekly", label: "Dành thời gian chất lượng cho người yêu/tuần", cadence: "WEEKLY" },
      { id: "relationships_new_connection_monthly", label: "Xây dựng mối quan hệ mới/tháng", cadence: "MONTHLY" },
    ],
  },
] as const satisfies readonly { key: string; label: string; options: readonly JourneyGoalOption[] }[];

export type JourneyGoalDomainKey = (typeof JOURNEY_GOAL_DOMAINS)[number]["key"];

export function findGoalOption(domainKey: string, optionId: string): JourneyGoalOption | undefined {
  const domain = JOURNEY_GOAL_DOMAINS.find((d) => d.key === domainKey);
  return domain?.options.find((o) => o.id === optionId);
}

export type JourneyCommitments = {
  wakeTime?: string;
  goals?: Partial<Record<string, { optionId: string; label: string; cadence: JourneyGoalCadence }[]>>;
  committedAt?: string;
};

function parseJourneyCommitments(value: unknown): JourneyCommitments | null {
  if (!value || typeof value !== "object") return null;
  return value as JourneyCommitments;
}

function commitmentLabelsByCadence(commitments: unknown, cadence: JourneyGoalCadence): string[] {
  const parsed = parseJourneyCommitments(commitments);
  if (!parsed?.goals) return [];
  return Object.values(parsed.goals)
    .flatMap((list) => list ?? [])
    .filter((g) => g.cadence === cadence)
    .map((g) => g.label);
}

/** Cam kết nhịp WEEKLY đã chọn lúc bắt đầu hành trình — bắt buộc tick trong Weekly Challenge. */
export function weeklyCommitmentLabels(commitments: unknown): string[] {
  return commitmentLabelsByCadence(commitments, "WEEKLY");
}

/** Cam kết nhịp MONTHLY đã chọn lúc bắt đầu hành trình — bắt buộc tick trong Monthly Challenge. */
export function monthlyCommitmentLabels(commitments: unknown): string[] {
  return commitmentLabelsByCadence(commitments, "MONTHLY");
}

/** Cam kết nhịp WEEKLY kèm optionId — dùng để hiển thị/tick ở "Công việc cần làm" (tab Tuần). */
export function weeklyCommitmentOptions(commitments: unknown): { optionId: string; label: string }[] {
  const parsed = parseJourneyCommitments(commitments);
  if (!parsed?.goals) return [];
  return Object.values(parsed.goals)
    .flatMap((list) => list ?? [])
    .filter((g) => g.cadence === "WEEKLY")
    .map((g) => ({ optionId: g.optionId, label: g.label }));
}

/** Giờ thức dậy cố định đã chọn lúc bắt đầu hành trình (vd. "06:30"), hiển thị lại trong "Công việc cần làm". */
export function getCommittedWakeTime(commitments: unknown): string | undefined {
  return parseJourneyCommitments(commitments)?.wakeTime;
}
