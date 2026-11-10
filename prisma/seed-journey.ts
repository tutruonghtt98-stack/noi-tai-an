import "dotenv/config";
import { PrismaClient, type Prisma } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL });
const db = new PrismaClient({ adapter });

type Phase = {
  number: number;
  slug: string;
  title: string;
  tagline: string;
  objective: string;
  skills: string[];
  themes: string[];
  weekly: { title: string; description: string }[];
  monthly: { title: string; description: string; criteria: string[] };
  reflections: string[];
};

const phases: Phase[] = [
  {
    number: 1,
    slug: "reset",
    title: "RESET",
    tagline: "DAY 01-30 · THE FOUNDATION",
    objective: "Nhìn rõ hiện trạng, sắp xếp lại nhịp sống và thiết lập những thói quen nền tảng vừa sức.",
    skills: ["Nhận thức bản thân", "Kiểm soát bản thân", "Nhận thức thời gian", "Kỷ luật cơ bản", "Thiết lập mục tiêu"],
    themes: [
      "Ghi lại một ngày đang diễn ra như thế nào", "Quan sát giờ thức dậy thực tế", "Để điện thoại ngoài tầm tay buổi sáng",
      "Sắp xếp lại nơi bắt đầu ngày mới", "Tạo một tín hiệu uống nước dễ nhớ", "Chọn giờ kết thúc ngày phù hợp",
      "Đối chiếu kế hoạch với tuần vừa qua", "Nhận diện lần mở mạng xã hội theo phản xạ", "Ghi lại điều làm năng lượng tăng và giảm",
      "Đặt một ranh giới nhỏ cho màn hình", "Dọn một bề mặt thường dùng", "Chuẩn bị một lựa chọn ăn uống có ý thức",
      "Sắp xếp giấy tờ cần xử lý", "Loại bỏ một nguồn gây nhiễu số", "Tạo nghi thức khép lại tuần",
      "Gọi tên một thói quen muốn thay đổi", "Nhận diện tình huống kích hoạt thói quen cũ", "Thử một hành động thay thế lành mạnh",
      "Dành vài phút quan sát cảm xúc", "Viết ba ưu tiên thực tế", "Hoàn tất một việc nhỏ còn tồn đọng",
      "Tạo lịch ngày mai có khoảng nghỉ", "Viết một mục tiêu 180 ngày có thể quan sát", "Nêu lý do cá nhân đằng sau mục tiêu",
      "Chọn một cam kết buổi sáng", "Chọn một cam kết cuối ngày", "So sánh thời gian dự kiến với thực tế",
      "Ghi nhận tiến bộ nhỏ đã có", "Điều chỉnh một thói quen quá tham vọng", "Viết cam kết nền tảng cho chặng kế tiếp",
    ],
    weekly: [
      { title: "Wake Up Challenge", description: "Chọn khung giờ thức dậy khả thi và theo dõi mức độ duy trì trong tuần." },
      { title: "Digital Detox", description: "Nhận diện thời gian dùng mạng xã hội và chủ động tạo các khoảng không màn hình." },
      { title: "Clean Environment", description: "Sắp xếp không gian sống hoặc làm việc để giảm ma sát cho thói quen tốt." },
      { title: "Consistency", description: "Duy trì các thói quen nền tảng đã chọn, ưu tiên đều đặn thay vì hoàn hảo." },
    ],
    monthly: {
      title: "THE RESET CHALLENGE",
      description: "Lập bản đồ hiện trạng và chọn một hệ thống sinh hoạt nền tảng cho hành trình.",
      criteria: ["Hoàn thành đánh giá ban đầu", "Liệt kê 5 thói quen muốn thay đổi", "Chọn 5 thói quen tích cực phù hợp", "Viết lịch sinh hoạt khả thi", "Chọn 3 mục tiêu 180 ngày", "Viết cam kết cá nhân"],
    },
    reflections: ["Tôi đang dùng thời gian vào việc gì?", "Thói quen nào đang cản trở tôi?", "Tôi muốn trở thành người như thế nào?", "Điều gì khiến việc thay đổi khó khăn?", "Lịch sống hiện tại có phản ánh ưu tiên của tôi không?"],
  },
  {
    number: 2,
    slug: "discipline",
    title: "DISCIPLINE",
    tagline: "DAY 31-60 · BUILD YOUR DISCIPLINE",
    objective: "Biến cam kết thành hành động lặp lại, chủ động xử lý trì hoãn và chịu trách nhiệm với lựa chọn của mình.",
    skills: ["Tính nhất quán", "Trách nhiệm", "Quản lý thời gian", "Tự kỷ luật", "Cam kết"],
    themes: [
      "Giữ một lời hứa nhỏ với bản thân", "Bắt đầu việc khó trước khi kiểm tra thông báo", "Chia một việc trì hoãn thành bước đầu tiên",
      "Thực hiện lịch buổi sáng đã chọn", "Đặt giờ bắt đầu cho một phiên tập trung", "Chuẩn bị đồ dùng trước buổi vận động",
      "Hoàn thành việc đã cam kết dù tâm trạng thấp", "Theo dõi một lần trì hoãn mà không tự trách", "Khép lại một nhiệm vụ trước khi mở việc mới",
      "Dùng lịch để bảo vệ thời gian nghỉ", "Thử quy tắc bắt đầu trong năm phút", "Giảm một nguồn xao nhãng lặp lại",
      "Nêu rõ điều mình chịu trách nhiệm", "Tạo nhắc việc cho cam kết quan trọng", "Kiểm tra deadline trước khi nhận thêm việc",
      "Hoàn thành một phiên vận động theo kế hoạch", "Giữ giờ đi ngủ đã chọn", "Chuẩn bị phương án khi lịch bị gián đoạn",
      "Thực hiện một việc không cần chờ cảm hứng", "Ghi nguyên nhân của một cam kết chưa xong", "Điều chỉnh kế hoạch thay vì bỏ cuộc",
      "Thực hành nói không với một xao nhãng", "Chia ngày thành các khối thời gian thực tế", "Xử lý một việc tồn đọng đúng hẹn",
      "Theo dõi mức năng lượng trước khi sắp lịch", "Duy trì một thói quen cốt lõi liên tục", "Xin hỗ trợ trước khi trễ cam kết",
      "Rà soát các cam kết đã nhận", "Hoàn thành thử thách duy trì bảy ngày", "Viết quy tắc kỷ luật phù hợp với mình",
    ],
    weekly: [
      { title: "No Excuses", description: "Hoàn thành các cam kết nhỏ đã chọn và ghi lại cách bạn xử lý trở ngại." },
      { title: "Time Management", description: "Lập kế hoạch theo thời lượng thực tế, bao gồm cả thời gian nghỉ và chuyển việc." },
      { title: "Control Yourself", description: "Giảm một hành vi gây xao nhãng bằng cách thay đổi môi trường hoặc tín hiệu." },
      { title: "Discipline Test", description: "Duy trì các cam kết cốt lõi trong bảy ngày, không yêu cầu điểm tuyệt đối." },
    ],
    monthly: {
      title: "THE DISCIPLINE CHALLENGE",
      description: "Thực hành giữ cam kết và quản lý thời gian qua những hành động nhỏ, lặp lại được.",
      criteria: ["Duy trì giờ thức dậy đã chọn", "Theo dõi thói quen cốt lõi", "Lập kế hoạch ngày phù hợp sức lực", "Ghi nhận nguyên nhân trì hoãn", "Hoàn thành thử thách kỷ luật 7 ngày", "Tổng kết tỷ lệ hoàn thành đúng hạn từ Workspace"],
    },
    reflections: ["Tôi có giữ lời hứa với mình không?", "Tôi thường trì hoãn điều gì?", "Điều gì làm tôi mất tập trung?", "Kế hoạch của tôi có tính đến thời gian nghỉ không?", "Tôi chịu trách nhiệm thế nào với kết quả của mình?"],
  },
  {
    number: 3,
    slug: "growth",
    title: "GROWTH",
    tagline: "DAY 61-90 · EXPAND YOUR POTENTIAL",
    objective: "Học có chủ đích, luyện một kỹ năng quan trọng và biến kiến thức thành kết quả có thể quan sát.",
    skills: ["Tư duy học tập", "Phát triển kỹ năng", "Tư duy phản biện", "Sáng tạo", "Giải quyết vấn đề"],
    themes: [
      "Chọn một kỹ năng đáng đầu tư", "Đo mức hiện tại của kỹ năng", "Tìm một nguồn học đáng tin cậy",
      "Chia kỹ năng thành các thành phần", "Luyện một thao tác cơ bản có phản hồi", "Ghi lại lỗi thường gặp khi thực hành",
      "Giải thích một khái niệm bằng lời của mình", "Tìm ví dụ thực tế cho điều vừa học", "Đặt câu hỏi phản biện với một nguồn tin",
      "Thử một phương pháp học khác", "Tạo một ghi chú có thể dùng lại", "Xin nhận xét từ người có kinh nghiệm",
      "Áp dụng một kiến thức vào tình huống thật", "So sánh hai cách giải quyết một vấn đề", "Tạo bản nháp đầu tiên cho dự án học tập",
      "Thực hành kỹ năng trong điều kiện giới hạn", "Tìm điểm yếu trong sản phẩm thử nghiệm", "Sửa một lỗi dựa trên phản hồi",
      "Dạy lại một điều vừa học", "Lưu bằng chứng tiến bộ của kỹ năng", "Chọn một tiêu chí đánh giá sản phẩm",
      "Hoàn thành một phần việc có thể trình bày", "Kết nối kỹ năng với mục tiêu cá nhân", "Cắt một phần không cần thiết của dự án",
      "Thử nghiệm một ý tưởng mới", "Tổng hợp bài học từ lần thử", "Đóng gói sản phẩm hoặc kết quả học tập",
      "Trình bày sản phẩm cho một người khác", "Đánh giá tiến bộ bằng tiêu chí ban đầu", "Chọn bước phát triển tiếp theo",
    ],
    weekly: [
      { title: "Learn Something New", description: "Chọn một chủ đề nhỏ và ghi lại điều bạn hiểu rõ hơn sau tuần này." },
      { title: "Skill Building", description: "Dành các phiên luyện tập có phản hồi cho một kỹ năng đã chọn." },
      { title: "Apply What You Learn", description: "Đưa ít nhất một kiến thức vào tình huống thực tế và ghi nhận kết quả." },
      { title: "Create Something", description: "Hoàn thành một sản phẩm hoặc bằng chứng tiến bộ từ việc học." },
    ],
    monthly: {
      title: "THE GROWTH PROJECT",
      description: "Chọn một dự án học tập có đầu ra, chia nhỏ và hoàn thành sản phẩm có thể đánh giá.",
      criteria: ["Chọn một kỹ năng gắn với mục tiêu cá nhân", "Đặt tiêu chí đầu ra", "Chia dự án thành các mốc", "Theo dõi đầu việc bằng Workspace hiện có", "Thử nghiệm và nhận ít nhất một phản hồi", "Hoàn thành sản phẩm hoặc kết quả cụ thể"],
    },
    reflections: ["Tôi học được điều gì có giá trị?", "Kỹ năng nào đang tiến bộ?", "Tôi đã ứng dụng kiến thức vào đâu?", "Bằng chứng nào cho thấy tôi tiến bộ?", "Tôi cần học gì tiếp theo?"],
  },
  {
    number: 4,
    slug: "focus",
    title: "FOCUS",
    tagline: "DAY 91-120 · MASTER YOUR FOCUS",
    objective: "Bảo vệ sự chú ý, ưu tiên việc có giá trị và hoàn thành công việc sâu với nhịp bền vững.",
    skills: ["Làm việc sâu", "Sắp xếp ưu tiên", "Tư duy chiến lược", "Thực thi", "Quản lý sự chú ý"],
    themes: [
      "Xác định việc quan trọng nhất trong ngày", "Dọn không gian trước phiên tập trung", "Tắt một nhóm thông báo không thiết yếu",
      "Chia việc lớn thành một phiên làm sâu", "Ghi lại thời gian tập trung thực tế", "Tạo nghi thức bắt đầu phiên làm việc",
      "Đưa điện thoại ra khỏi tầm nhìn", "Làm một việc tại một thời điểm", "Đặt giới hạn cho việc kiểm tra hộp thư",
      "Dùng giờ nghỉ để phục hồi sự chú ý", "Đánh dấu các lần bị gián đoạn", "Chọn việc có tác động cao nhất",
      "Bắt đầu ngày bằng đầu việc ưu tiên", "Ước lượng thời gian trước khi làm", "So sánh thời gian dự kiến và thực tế",
      "Thực hiện hai phiên tập trung có nghỉ", "Từ chối một cuộc chuyển việc không cần thiết", "Gom các việc nhỏ vào một khung giờ",
      "Làm rõ tiêu chí hoàn thành trước khi bắt đầu", "Dành phiên tập trung cho mục tiêu dài hạn", "Xử lý một điểm nghẽn trong quy trình",
      "Đóng các tab không phục vụ đầu việc", "Hoàn thành việc quan trọng trước việc dễ", "Tạo khoảng đệm giữa các cuộc hẹn",
      "Giữ một khối thời gian không họp", "Đánh giá chất lượng đầu ra thay vì giờ bận", "Chốt việc dang dở trước khi chuyển nhiệm vụ",
      "Thử thách bảy ngày làm việc sâu", "Xem lại nguồn gây phân tán lớn nhất", "Viết quy tắc bảo vệ sự tập trung",
    ],
    weekly: [
      { title: "Eliminate Distractions", description: "Loại bỏ một nguồn gây gián đoạn có thể kiểm soát trong tuần." },
      { title: "Deep Work", description: "Lên lịch các phiên làm việc sâu phù hợp với năng lượng và nghĩa vụ thực tế." },
      { title: "Priority Management", description: "Chọn việc có tác động cao, tránh để việc dễ chiếm hết thời gian." },
      { title: "Execution Week", description: "Hoàn thành các đầu việc đã lên kế hoạch và ghi nhận chênh lệch thực tế." },
    ],
    monthly: {
      title: "THE DEEP WORK CHALLENGE",
      description: "Thực hiện thử thách tập trung trong bảy ngày, điều chỉnh thời lượng theo lịch và sức khỏe.",
      criteria: ["Chọn một khung tập trung phù hợp mỗi ngày", "Ghi lại thời lượng Deep Work thực tế", "Tắt mạng xã hội trong phiên", "Làm việc ưu tiên trước việc ít quan trọng", "Có nghỉ giữa các phiên", "Tổng kết kết quả và yếu tố gián đoạn"],
    },
    reflections: ["Việc nào tạo ra nhiều giá trị nhất?", "Điều gì làm gián đoạn tôi?", "Tôi có bận nhưng thiếu tiến triển không?", "Tôi bảo vệ sự chú ý bằng cách nào?", "Việc quan trọng nhất tiếp theo là gì?"],
  },
  {
    number: 5,
    slug: "mastery",
    title: "MASTERY",
    tagline: "DAY 121-150 · RAISE YOUR STANDARDS",
    objective: "Tự quản lý, nâng chất lượng đầu ra, phục hồi sau trở ngại và sở hữu một thành tựu có ý nghĩa.",
    skills: ["Làm chủ bản thân", "Khả năng phục hồi", "Lãnh đạo", "Ra quyết định", "Tinh thần làm chủ"],
    themes: [
      "Viết tiêu chuẩn hoàn thành cho một đầu ra", "Chủ động xử lý một vấn đề tồn đọng", "Đánh giá một quyết định gần đây",
      "Chọn việc dài hạn để bảo vệ trong lịch", "Xử lý phản hồi mà không phòng thủ", "Duy trì hành động sau một ngày khó",
      "Phân biệt điều mình kiểm soát và không kiểm soát", "Yêu cầu thông tin trước khi nhận cam kết", "Giao tiếp rõ khi có nguy cơ trễ hạn",
      "Loại bỏ một bước thừa trong quy trình", "Nâng chất lượng một sản phẩm đang làm", "Thiết lập giới hạn công việc hợp lý",
      "Chọn một cột mốc đo được cho dự án", "Giải quyết nguyên nhân thay vì triệu chứng", "Ghi lại quyết định và lý do",
      "Hoàn thành việc khó đã bắt đầu", "Kiểm tra chất lượng trước khi bàn giao", "Chủ động nhận trách nhiệm cho kết quả",
      "Tạo phương án dự phòng cho lịch bận", "Phục hồi nhịp sau một lần gián đoạn", "Nâng tiêu chuẩn sức khỏe mà vẫn vừa sức",
      "Đóng một cam kết không còn phù hợp", "Hỗ trợ một người khác bằng kinh nghiệm thực tế", "Đánh giá rủi ro của mục tiêu lớn",
      "Hoàn thành cột mốc cá nhân đã chọn", "Thu thập bằng chứng thành tựu", "Xin phản hồi về chất lượng kết quả",
      "Ghi nhận điều đã làm tốt dưới áp lực", "Rà soát tiêu chuẩn sống và làm việc", "Chọn nguyên tắc làm chủ cho chặng cuối",
    ],
    weekly: [
      { title: "Raise Your Standards", description: "Nâng một tiêu chuẩn đầu ra cụ thể, không tăng khối lượng vô hạn." },
      { title: "Resilience", description: "Duy trì bước tiếp theo khả thi khi kế hoạch gặp trở ngại." },
      { title: "Take Ownership", description: "Chủ động trao đổi, chịu trách nhiệm và xử lý phần việc thuộc mình." },
      { title: "Personal Achievement", description: "Hoàn tất một cột mốc quan trọng và lưu bằng chứng kết quả." },
    ],
    monthly: {
      title: "THE MASTERY PROJECT",
      description: "Chọn một mục tiêu lớn, tạo kế hoạch thực thi và đánh giá thành tựu bằng bằng chứng.",
      criteria: ["Xác định kết quả có thể kiểm chứng", "Chia kết quả thành đầu việc Workspace", "Đặt mốc và deadline hợp lý", "Theo dõi trở ngại và quyết định", "Hoàn thành ít nhất một cột mốc lớn", "Tổng kết kết quả thực tế và bài học"],
    },
    reflections: ["Tôi trưởng thành hơn ở điểm nào?", "Tôi đang làm chủ lịch sống ra sao?", "Tiêu chuẩn cá nhân nào đã nâng lên?", "Tôi phục hồi sau trở ngại thế nào?", "Thành tựu nào có ý nghĩa nhất với tôi?"],
  },
  {
    number: 6,
    slug: "transform",
    title: "TRANSFORM",
    tagline: "DAY 151-180 · BECOME A BETTER VERSION",
    objective: "Củng cố thay đổi bền vững, đánh giá hành trình và thiết kế hệ thống phát triển cho 12 tháng tiếp theo.",
    skills: ["Kỷ luật bền vững", "Nhận thức bản thân", "Tư duy dài hạn", "Cải thiện liên tục", "Tự lãnh đạo"],
    themes: [
      "Chọn ba thói quen cốt lõi để duy trì", "Đánh giá điều gì giúp thói quen bền hơn", "Bỏ một quy tắc không còn phục vụ mình",
      "So sánh cách dùng thời gian trước và nay", "Ghi nhận tiến bộ không thể hiện bằng điểm số", "Hoàn tất một việc đã bắt đầu từ trước",
      "Đánh giá thay đổi trong cách phản ứng", "Thiết kế một tuần có nhịp phục hồi", "Chọn dấu hiệu cảnh báo quá tải",
      "Tạo kế hoạch quay lại sau gián đoạn", "Xem lại mục tiêu công việc đã đạt", "Đóng hoặc điều chỉnh việc không còn phù hợp",
      "Liệt kê kỹ năng đã phát triển", "Tìm bằng chứng cho một thay đổi tư duy", "Xin phản hồi về sự tiến bộ",
      "Hoàn thành một mục tiêu còn dang dở", "Viết hệ thống duy trì một thói quen", "Đặt ranh giới giúp bảo vệ sức khỏe",
      "Lập bản tổng kết trước và sau", "Chọn bài học sẽ mang theo", "Xác định điều cần tiếp tục cải thiện",
      "Viết ba mục tiêu quan trọng 12 tháng", "Chia mục tiêu năm thành kế hoạch 90 ngày", "Tạo lịch kiểm tra tiến độ định kỳ",
      "Viết thư gửi bản thân tương lai", "Chọn người đồng hành hoặc nguồn hỗ trợ", "Xây dựng ngày nghỉ có chủ đích",
      "Tạo quy tắc quản lý năng lượng cá nhân", "Ghi nhận hành trình bằng một nghi thức", "Cam kết một bước tiếp theo bền vững",
    ],
    weekly: [
      { title: "Maintain Your Discipline", description: "Duy trì các thói quen cốt lõi ở mức bền vững thay vì tăng cường độ." },
      { title: "Review Your Growth", description: "Đối chiếu dữ liệu và ghi nhận thay đổi trong tư duy, thói quen, hiệu suất." },
      { title: "Complete What You Started", description: "Chọn việc còn dang dở có ý nghĩa và hoàn thành hoặc chủ động đóng lại." },
      { title: "Build Your Future", description: "Thiết kế các mục tiêu và hệ thống duy trì sau hành trình." },
    ],
    monthly: {
      title: "THE TRANSFORMATION CHALLENGE",
      description: "Đánh giá toàn hành trình, lưu báo cáo Before & After và lập kế hoạch phát triển tiếp theo.",
      criteria: ["So sánh hiện trạng trước và sau", "Tổng kết thói quen đã hình thành", "Xem báo cáo công việc từ Workspace", "Chọn 3 mục tiêu 12 tháng", "Lập kế hoạch 90 ngày", "Viết thư gửi bản thân tương lai"],
    },
    reflections: ["Tôi đã thay đổi điều gì sau hành trình?", "Thành tựu lớn nhất là gì?", "Tôi đã vượt qua giới hạn nào?", "Thói quen nào sẽ đồng hành cùng tôi?", "Tôi muốn trở thành ai trong 12 tháng tới?"],
  },
];

const healthActions = [
  "đi bộ ngoài trời với nhịp vừa sức", "vận động khớp và giãn cơ nhẹ", "chuẩn bị một bữa ăn có ý thức", "đi ngủ theo khung giờ đã chọn",
  "uống nước theo các mốc trong ngày", "tập một bài vận động phù hợp thể trạng", "nghỉ mắt và thả lỏng cơ thể đúng lúc", "đón ánh sáng tự nhiên vào buổi sáng",
  "đi cầu thang hoặc chọn một quãng đi bộ", "thực hiện bài thở chậm trong vài phút", "chuẩn bị đồ dùng cho buổi vận động", "ghi lại mức năng lượng trước và sau hoạt động",
];
const growthActions = [
  "đọc một phần ngắn và ghi lại ý chính", "học một khái niệm rồi diễn đạt bằng lời mình", "luyện một kỹ năng trong phiên có bấm giờ", "ghi ba câu hỏi cần tìm hiểu tiếp",
  "nghe nội dung giáo dục rồi tóm tắt", "thử một bài tập thực hành có phản hồi", "so sánh hai cách tiếp cận một vấn đề", "lưu một ghi chú có thể áp dụng lại",
  "giải thích điều vừa học cho người khác", "tìm một ví dụ thực tế cho khái niệm", "ghi nhận lỗi và cách sửa trong lúc luyện", "áp dụng một ý tưởng vào tình huống đời thực",
];
const productivityActions = [
  "xác định việc quan trọng nhất và bước mở đầu", "kiểm tra một deadline trong Workspace hiện có", "hoàn thành một bước của mục tiêu dài hạn",
  "ước lượng thời gian cho một đầu việc", "chia một kết quả lớn thành bước kế tiếp", "dọn một trở ngại khỏi quy trình làm việc",
  "chốt tiêu chí hoàn thành trước khi bắt đầu", "rà soát một việc đang chờ phản hồi", "lập lịch cho phiên tập trung tiếp theo",
  "cập nhật tiến độ một việc trong Workspace", "đóng một đầu việc nhỏ đã lên kế hoạch", "ghi một quyết định và bước tiếp theo",
];

const quotes = [
  "Một bước nhỏ có chủ đích vẫn là một bước tiến.", "Sự đều đặn thường bắt đầu bằng việc làm cho bước đầu dễ hơn.",
  "Kế hoạch tốt là kế hoạch còn chỗ cho con người thật của bạn.", "Tiến bộ có thể yên lặng mà vẫn rất thật.",
  "Hãy chọn việc quan trọng, rồi dành cho nó một khoảng thời gian thật.", "Nghỉ ngơi là một phần của nhịp bền vững.",
  "Bạn không cần làm hoàn hảo để tiếp tục.", "Sự chú ý là nguồn lực cần được bảo vệ.",
  "Một lời hứa nhỏ được giữ lại có thể xây nên lòng tin.", "Bắt đầu lại cũng là một kỹ năng.",
  "Điều học được trở nên có giá trị khi được đem ra thử.", "Rõ ràng hơn một chút cũng là tiến bộ.",
  "Đừng đo một ngày chỉ bằng số việc đã làm.", "Giới hạn hợp lý giúp cam kết sống lâu hơn.",
  "Chất lượng thường cần khoảng lặng.", "Hãy ghi nhận điều mình kiểm soát được hôm nay.",
  "Cách bạn quay lại quan trọng hơn một lần lỡ nhịp.", "Một hệ thống tốt làm điều đúng trở nên dễ hơn.",
  "Tập trung vào bước tiếp theo, không phải toàn bộ con đường.", "Tiến bộ bền vững không cần phô trương.",
  "Hành động nhỏ cho bạn dữ liệu để chọn bước lớn hơn.", "Thành tựu bắt đầu từ tiêu chí rõ ràng.",
  "Thời gian nghỉ cũng cần được đặt vào kế hoạch.", "Kiên trì có thể đi cùng sự điều chỉnh.",
  "Bạn được phép chọn nhịp phù hợp với mình.", "Một ngày trung thực tốt hơn một ngày check-in cho đẹp.",
  "Hãy để mục tiêu phục vụ cuộc sống, không thay thế cuộc sống.", "Tập trung vào điều có ý nghĩa trước điều gây ồn.",
  "Một kết thúc rõ ràng mở đường cho khởi đầu nhẹ hơn.", "Nhìn lại giúp bước tiếp theo sáng hơn.",
];

const achievements = [
  { code: "JOURNEY_FIRST_STEP", title: "First Step", description: "Hoàn thành ngày đầu tiên của hành trình.", metric: "completed_days", threshold: 1 },
  { code: "JOURNEY_STREAK_7", title: "7-Day Streak", description: "Hoàn thành bảy ngày hành trình liên tiếp.", metric: "consecutive_completed_days", threshold: 7 },
  { code: "JOURNEY_CONSISTENCY_30", title: "Consistency", description: "Hoàn thành 30 ngày hành trình.", metric: "completed_days", threshold: 30 },
  { code: "JOURNEY_DEADLINE_MASTER", title: "Deadline Master", description: "Hoàn thành 20 công việc Workspace trước hoặc đúng hạn.", metric: "workspace_on_time", threshold: 20 },
  { code: "JOURNEY_FOCUSED_MIND", title: "Focused Mind", description: "Hoàn thành thử thách tập trung của Level Focus.", metric: "monthly_challenge_level_4", threshold: 1 },
  { code: "JOURNEY_DISCIPLINE_BUILDER", title: "Discipline Builder", description: "Đạt 1.000 Discipline Points.", metric: "discipline_points", threshold: 1000 },
  { code: "JOURNEY_GROWTH_SEEKER", title: "Growth Seeker", description: "Hoàn thành dự án phát triển của Level Growth.", metric: "monthly_challenge_level_3", threshold: 1 },
  { code: "JOURNEY_TRANSFORMER", title: "Transformer", description: "Hoàn thành đủ sáu Level của hành trình.", metric: "journey_complete", threshold: 1 },
];

const makeMission = (phase: Phase, day: number, sequence: number, theme: string) => {
  const minutes = [20, 30, 45, 50, 45, 30][phase.number - 1]!;
  const xp = 5 + phase.number;
  const actionSets = [healthActions, growthActions, productivityActions] as const;
  const types = ["HEALTH", "PERSONAL_GROWTH", "PRODUCTIVITY"] as const;
  const action = actionSets[sequence - 1]![(day * 3 + phase.number * 5 + sequence) % actionSets[sequence - 1]!.length]!;
  const title = sequence === 1 ? `Chăm sóc nền tảng: ${theme}` : sequence === 2 ? `Mở rộng năng lực: ${theme}` : `Thực thi có chủ đích: ${theme}`;
  const description = sequence === 1
    ? `Trong khoảng ${minutes} phút, ${action}. Giữ cường độ phù hợp và liên hệ hoạt động này với chủ đề hôm nay: ${theme.toLowerCase()}.`
    : sequence === 2
      ? `Dành ${minutes} phút để ${action}. Lưu lại một điều cụ thể bạn hiểu thêm về chủ đề: ${theme.toLowerCase()}.`
      : `Trong ${minutes} phút, ${action}. Không tạo task trùng; nếu cần theo dõi công việc, cập nhật đầu việc tương ứng trong Workspace.`;
  return {
    levelId: "",
    dayInLevel: day,
    sequence,
    title,
    description,
    objective: sequence === 3 ? `Tạo một bước tiến có thể quan sát cho chủ đề ${theme.toLowerCase()}.` : `Thực hành một hành động vừa sức gắn với ${theme.toLowerCase()}.`,
    type: types[sequence - 1]!,
    suggestedMinutes: minutes,
    xpReward: xp,
    completionCriteria: sequence === 1
      ? `Hoàn thành hoạt động đã chọn trong khoảng ${minutes} phút hoặc ghi rõ điều chỉnh an toàn phù hợp thể trạng.`
      : sequence === 2
        ? `Lưu một ghi chú, ví dụ hoặc kết quả luyện tập gắn với chủ đề ${theme.toLowerCase()}.`
        : `Hoàn tất bước đã chọn và ghi nhận kết quả trong kế hoạch cá nhân hoặc Workspace hiện có.`,
    active: true,
  };
};

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Không chạy seed journey trực tiếp trên production.");
  const exists = await db.journeyProgram.findUnique({ where: { code_version: { code: "STILL_BETTER_180", version: 1 } }, select: { id: true } });
  if (exists) {
    console.log("Journey content already exists; leaving admin edits untouched.");
    return;
  }

  await db.$transaction(async (tx) => {
    const now = new Date();
    const program = await tx.journeyProgram.create({
      data: {
        code: "STILL_BETTER_180",
        version: 1,
        durationDays: 180,
        title: "STILL / BETTER · Hành trình 180 ngày",
        description: "Sáu chặng phát triển cá nhân, tiến triển theo nhịp có thể duy trì.",
        status: "PUBLISHED",
        publishedAt: now,
      },
    });
    await tx.journeyRuleSet.create({
      data: {
        programId: program.id,
        version: 1,
        publishedAt: now,
        missionWeight: 60,
        habitWeight: 20,
        workspaceWeight: 20,
        levelCompletionThreshold: 75,
        earlyCompletionPoints: 15,
        onTimeCompletionPoints: 10,
        importantWorkBonus: 5,
        assignedAndCompletedSameDayBonus: 5,
        overdueFirstDayPenalty: 5,
        overdueAdditionalDayPenalty: 2,
        maxOverduePenalty: null,
        importantLabel: "IMPORTANT",
        teamAssignmentPolicy: "DIRECT_ONLY",
      },
    });

    for (const phase of phases) {
      const startDay = (phase.number - 1) * 30 + 1;
      const level = await tx.journeyLevel.create({
        data: {
          programId: program.id,
          number: phase.number,
          startDay,
          endDay: startDay + 29,
          slug: phase.slug,
          title: phase.title,
          tagline: phase.tagline,
          description: phase.objective,
          objective: phase.objective,
          skills: phase.skills,
          reflectionQuestions: phase.reflections,
          completionThreshold: 75,
          completionCriteria: { coreMissionRate: 75, monthlyChallenge: true, finalReview: true } as Prisma.InputJsonValue,
          reportSections: ["Điểm mạnh", "Trở ngại", "Tiến độ công việc", "Bước tiếp theo"] as Prisma.InputJsonValue,
        },
      });

      const missions = phase.themes.flatMap((theme, index) => {
        const day = index + 1;
        return [1, 2, 3].map((sequence) => ({ ...makeMission(phase, day, sequence, theme), levelId: level.id }));
      });
      await tx.journeyMission.createMany({ data: missions });

      const weeks = phase.weekly.map((challenge, index) => {
        const weekNumber = (phase.number - 1) * 4 + index + 1;
        const weekStart = startDay + index * 7;
        const weekEnd = index === 3 ? startDay + 29 : weekStart + 6;
        return {
          programId: program.id,
          levelId: level.id,
          weekNumber,
          startDay: weekStart,
          endDay: weekEnd,
          title: challenge.title,
          description: challenge.description,
          completionCriteria: `Theo dõi hành động trong ngày ${weekStart}-${weekEnd}; hoàn thành ít nhất 75% mục tiêu cá nhân đã chọn.`,
          xpReward: 20,
          active: true,
        };
      });
      await tx.journeyWeeklyChallenge.createMany({ data: weeks });

      await tx.journeyMonthlyChallenge.create({
        data: {
          levelId: level.id,
          title: phase.monthly.title,
          description: phase.monthly.description,
          completionCriteria: phase.monthly.criteria as Prisma.InputJsonValue,
          xpReward: 100,
        },
      });
    }

    const dailyChallenges = phases.flatMap((phase) => phase.themes.map((theme, index) => {
      const journeyDay = (phase.number - 1) * 30 + index + 1;
      return {
        programId: program.id,
        journeyDay,
        title: `Thử thách ngày ${String(journeyDay).padStart(3, "0")}: ${theme}`,
        description: `Chọn một hành động nhỏ, vừa sức để thực hành chủ đề “${theme.toLowerCase()}”.`,
        completionCriteria: "Ghi nhận một hành động cụ thể đã thực hiện hoặc một điều học được; ngày nghỉ hợp lệ không bị phạt.",
        xpReward: 3,
      };
    }));
    await tx.journeyDailyChallenge.createMany({ data: dailyChallenges });

    await tx.journeyQuote.createMany({
      data: quotes.map((quote, index) => ({ programId: program.id, quote, dayNumber: index + 1 })),
    });
    await tx.journeyAchievementDefinition.createMany({
      data: achievements.map((achievement) => ({ programId: program.id, ...achievement, xpReward: 25 })),
    });
  }, { timeout: 30_000 });

  console.log("Seeded STILL / BETTER: 6 levels, 540 missions, 180 daily challenges, 24 weekly challenges, 6 monthly challenges.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });