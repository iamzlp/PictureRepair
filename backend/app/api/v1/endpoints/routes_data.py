from app.schemas.route import Route, RouteStop
from app.schemas.task import ArtStyle

FEATURED_ROUTES = [
    Route(
        id="paris-classic",
        title="浪漫巴黎三天两夜",
        description="在埃菲尔铁塔下野餐，在卢浮宫旁漫步，体验极致的法式浪漫。",
        cover_url="https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=800&q=80",
        days=3,
        default_style=ArtStyle.REALISTIC,
        stops=[
            RouteStop(
                id="eiffel",
                name="埃菲尔铁塔",
                description="Champ de Mars 草坪野餐",
                prompt_template="A photo of a tourist having a picnic on the Champ de Mars grass, Eiffel Tower in the background, sunny afternoon, baguette and wine, romantic atmosphere, high quality",
                cover_url="https://images.unsplash.com/photo-1511739001486-6bfe10ce7859?w=500&q=80"
            ),
            RouteStop(
                id="louvre",
                name="卢浮宫",
                description="金字塔前的艺术时刻",
                prompt_template="A photo of a tourist posing in front of the Louvre Museum glass pyramid at twilight, dramatic sky, glowing lights, fashion photography style",
                cover_url="https://images.unsplash.com/photo-1499856871940-a09627c6dcf6?w=500&q=80"
            ),
            RouteStop(
                id="cafe",
                name="左岸咖啡馆",
                description="Café de Flore 的午后",
                prompt_template="A photo of a tourist sitting at a street corner cafe in Paris, holding a coffee cup, vintage style, blurred pedestrians, relaxed vibe",
                cover_url="https://images.unsplash.com/photo-1550340499-a6c6088666d1?w=500&q=80"
            )
        ]
    ),
    Route(
        id="tokyo-cyberpunk",
        title="东京霓虹赛博夜",
        description="穿梭于新宿的霓虹灯与涉谷的十字路口，感受未来的脉搏。",
        cover_url="https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=800&q=80",
        days=3,
        default_style=ArtStyle.CYBERPUNK,
        stops=[
            RouteStop(
                id="shibuya",
                name="涉谷十字路口",
                description="繁忙人潮中的静止",
                prompt_template="A photo of a tourist standing in the middle of Shibuya Crossing, Tokyo, neon lights, rainy night, reflections on wet ground, cyberpunk style, futuristic vibe",
                cover_url="https://images.unsplash.com/photo-1542051841857-5f90071e7989?w=500&q=80"
            ),
            RouteStop(
                id="shinjuku",
                name="新宿小巷",
                description="居酒屋的烟火气",
                prompt_template="A photo of a tourist walking in a narrow alley in Shinjuku, red lanterns, steam from food stalls, cyberpunk neon signs, cinematic lighting",
                cover_url="https://images.unsplash.com/photo-1554797589-7241bb691973?w=500&q=80"
            ),
            RouteStop(
                id="akihabara",
                name="秋叶原",
                description="二次元的朝圣",
                prompt_template="A photo of a tourist surrounded by anime billboards in Akihabara, bright colorful lights, futuristic city background, tech vibe",
                cover_url="https://images.unsplash.com/photo-1578450671530-5b6a7c9f32a8?w=500&q=80"
            )
        ]
    ),
    Route(
        id="maldives-relax",
        title="马尔代夫梦幻岛",
        description="水上屋、玻璃海，享受纯粹的度假时光。",
        cover_url="https://images.unsplash.com/photo-1514282401047-d79a71a590e8?w=800&q=80",
        days=3,
        default_style=ArtStyle.REALISTIC,
        stops=[
            RouteStop(
                id="water-villa",
                name="水上屋",
                description="醒来就是大海",
                prompt_template="A photo of a tourist relaxing on the deck of a Maldives water villa, turquoise ocean water, sunny blue sky, tropical vacation, luxury travel",
                cover_url="https://images.unsplash.com/photo-1467377791767-c929b5dc9a23?w=500&q=80"
            ),
            RouteStop(
                id="beach-swing",
                name="海上秋千",
                description="网红打卡点",
                prompt_template="A photo of a tourist on a swing over the ocean, white sand beach, palm trees, golden hour lighting, dreamy atmosphere",
                cover_url="https://images.unsplash.com/photo-1596436889106-be35e843f974?w=500&q=80"
            ),
            RouteStop(
                id="underwater",
                name="海底餐厅",
                description="与鱼群共进晚餐",
                prompt_template="A photo of a tourist dining in an underwater restaurant, glass walls, colorful coral reef and fish outside, blue lighting, magical vibe",
                cover_url="https://images.unsplash.com/photo-1582650625119-3a31f8fa2699?w=500&q=80"
            )
        ]
    )
]
